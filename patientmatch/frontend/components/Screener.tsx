// frontend/components/Screener.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { z } from "zod";
import { logEvent } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { evaluateTrial, type EvaluationResult } from "@/lib/matching/evaluator";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Clock3, HeartHandshake, Info, MoreHorizontal, ChevronDown } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import AuroraBG from "@/components/AuroraBG";
import type { ProfileCookie } from "@/shared/profileCookie";
import type { UiQuestion } from "@/lib/screener/types";
import ScreenerInput from "@/components/screener/ScreenerInput";

const isDebug =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("debug") === "1";
const dbgInput = isDebug ? "border-black text-black placeholder:text-black ring-2 ring-blue-500" : "";
const CLINIC_TAG = "clinic";

type Trial = {
  nct_id: string;
  title: string;
  sponsor?: string;
  condition?: string;
  conditionSlug?: string | null;
  min_age_years?: number | null;
  max_age_years?: number | null;
  gender?: string | null;
};

type ScreenerProps = {
  trial: Trial;
  initialAnswers?: Record<string, unknown>;
  precalculatedQuestions?: UiQuestion[];
  optionalQuestions?: UiQuestion[];
  initialProfile?: ProfileCookie | null;
  onCompleted?: (payload: {
    answers: Record<string, unknown>;
    evaluation: EvaluationResult;
  }) => void;
  onProfileCleared?: () => void;
  showDebug?: boolean;
  compact?: boolean;
  clinicPreview?: boolean;
};

type AnswerMap = Record<string, unknown>;

type CompletionStatus = "provided" | "skipped" | "unsure";

const AFFIRMATIONS = [
  "Got it, thanks.",
  "Appreciate you sharing that.",
  "Noted — that helps.",
  "Thanks. We'll keep that in mind.",
  "Perfect, that gives us clarity.",
];

const STATUS_AFFIRMATIONS: Record<CompletionStatus, string> = {
  provided: "Thanks for letting me know.",
  skipped: "All good — we can come back to this later.",
  unsure: "Thanks for being honest. We'll keep it flexible.",
};

const SENSITIVE_KEYWORDS = ["pregnan", "medication", "drug", "treatment", "mental", "cancer", "liver", "kidney"];

type NumberBounds = {
  min?: number;
  max?: number;
  minInclusive?: boolean;
  maxInclusive?: boolean;
};

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function extractNumberBounds(question: UiQuestion): NumberBounds {
  const bounds: NumberBounds = {};
  if (getQuestionKind(question) !== "number") {
    return bounds;
  }

  const applyMin = (value: unknown, inclusive = true) => {
    const numeric = toFiniteNumber(value);
    if (numeric === undefined) return;
    bounds.min = numeric;
    bounds.minInclusive = inclusive;
  };

  const applyMax = (value: unknown, inclusive = true) => {
    const numeric = toFiniteNumber(value);
    if (numeric === undefined) return;
    bounds.max = numeric;
    bounds.maxInclusive = inclusive;
  };

  if (typeof question.minValue === "number") {
    bounds.min = question.minValue;
    bounds.minInclusive = question.minInclusive ?? true;
  }
  if (typeof question.maxValue === "number") {
    bounds.max = question.maxValue;
    bounds.maxInclusive = question.maxInclusive ?? true;
  }

  const rule = question.clause.rule as { operator?: string; value?: unknown; min?: unknown; max?: unknown } | undefined;
  if (rule) {
    const operator = typeof rule.operator === "string" ? rule.operator.toLowerCase() : undefined;
    const rawValue = rule.value;

    if (operator === "between" && Array.isArray(rawValue) && rawValue.length >= 2) {
      const numericValues = rawValue
        .map((entry) => toFiniteNumber(entry))
        .filter((entry): entry is number => entry !== undefined);
      if (numericValues.length >= 2) {
        applyMin(Math.min(...numericValues), true);
        applyMax(Math.max(...numericValues), true);
      }
    } else if (operator === ">" || operator === "gt") {
      applyMin(rawValue, false);
    } else if (operator === ">=" || operator === "min") {
      applyMin(rawValue, true);
    } else if (operator === "<" || operator === "lt") {
      applyMax(rawValue, false);
    } else if (operator === "<=" || operator === "max") {
      applyMax(rawValue, true);
    } else if (operator === "=" || operator === "==" || operator === "equals") {
      const numeric = toFiniteNumber(rawValue);
      if (numeric !== undefined) {
        applyMin(numeric, true);
        applyMax(numeric, true);
      }
    }

    if (rule.min !== undefined) {
      applyMin(rule.min, true);
    }
    if (rule.max !== undefined) {
      applyMax(rule.max, true);
    }
  }

  if (typeof question.value === "number" && (!bounds.min || !bounds.max)) {
    if (!bounds.min) {
      bounds.min = question.value;
      bounds.minInclusive = true;
    }
    if (!bounds.max) {
      bounds.max = question.value;
      bounds.maxInclusive = true;
    }
  }

  return bounds;
}

const NUMERIC_FALLBACK_VARIABLES = new Set([
  "age",
  "age_year",
  "age_years",
  "height_cm",
  "height_in",
  "weight_kg",
  "weight_lb",
  "bmi",
  "years",
]);

function getQuestionKind(question: UiQuestion): string | undefined {
  const directKind = typeof question.kind === "string" ? question.kind : undefined;
  if (directKind) return directKind;

  const raw = question as Record<string, unknown>;
  const alternate =
    (typeof raw.type === "string" ? (raw.type as string) : undefined) ??
    (typeof raw.inputType === "string" ? (raw.inputType as string) : undefined);
  if (alternate) return alternate;

  const variable = (question.clause.rule?.variable ?? question.clause.rule?.field ?? "").toLowerCase();
  if (NUMERIC_FALLBACK_VARIABLES.has(variable)) {
    return "number";
  }

  const label = typeof question.label === "string" ? question.label.toLowerCase() : "";
  if (
    label.includes("age") ||
    label.includes("how old") ||
    label.includes("bmi") ||
    label.includes("body mass index")
  ) {
    return "number";
  }

  return undefined;
}

function getQuestionVariable(question: UiQuestion): string {
  return (
    (question.clause.rule?.variable ?? question.clause.rule?.field ?? "").toString().toLowerCase() || ""
  );
}

function buildInitialAnswerMap(initialAnswers: Record<string, unknown>): Map<string, unknown> {
  const map = new Map<string, unknown>();
  Object.entries(initialAnswers).forEach(([key, value]) => {
    if (typeof key === "string") {
      map.set(key.toLowerCase(), value);
    }
  });
  return map;
}

export function resolveInitialAnswerForQuestion(
  question: UiQuestion,
  initialAnswerMap: Map<string, unknown>,
): unknown {
  if (question.kind === "heading") return undefined;

  const candidates = new Set<string>();
  const id = question.id.toLowerCase();
  const variable = getQuestionVariable(question);
  const label = (question.label ?? "").toLowerCase();

  candidates.add(id);
  if (variable) candidates.add(variable);

  if (variable === "age_years" || variable === "age" || id.includes("age") || label.includes("age")) {
    candidates.add("age");
    candidates.add("age_years");
  }

  if (
    variable.includes("sex") ||
    variable.includes("gender") ||
    id.includes("sex") ||
    id.includes("gender") ||
    label.includes("sex") ||
    label.includes("gender")
  ) {
    candidates.add("sex");
    candidates.add("gender");
  }

  if (variable === "has_diabetes" || variable.includes("diabet")) {
    candidates.add("diabetes");
    candidates.add("has_diabetes");
  }

  if (variable === "has_hypertension" || variable.includes("hypertens")) {
    candidates.add("hypertension");
    candidates.add("has_hypertension");
  }

  if (variable === "has_cancer" || variable.includes("cancer")) {
    candidates.add("cancer");
    candidates.add("has_cancer");
  }

  for (const candidate of candidates) {
    const value = initialAnswerMap.get(candidate);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function isMultiSelectQuestion(question: UiQuestion): boolean {
  if (getQuestionKind(question) !== "choice") return false;
  const operator = typeof question.operator === "string" ? question.operator.toLowerCase() : undefined;
  if (operator && ["in", "any", "contains", "multiple"].includes(operator)) {
    return true;
  }
  const ruleValue = question.clause?.rule?.value;
  if (Array.isArray(ruleValue) && ruleValue.length > 1) {
    return true;
  }
  const optionsCount = Array.isArray(question.options) ? question.options.length : 0;
  return optionsCount > 4;
}

function formatNumeric(value: number): string {
  return Number.isInteger(value) ? `${value}` : `${value}`.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function getRangeDescription(question: UiQuestion | null | undefined): string | null {
  if (!question || getQuestionKind(question) !== "number") return null;
  const min = typeof question.minValue === "number" ? question.minValue : undefined;
  const max = typeof question.maxValue === "number" ? question.maxValue : undefined;
  if (min === undefined && max === undefined) return null;

  const label = question.label.toLowerCase();
  const mentionsAge = label.includes("age");

  if (min !== undefined && max !== undefined) {
    if (mentionsAge) {
      return `This study is for ages ${formatNumeric(min)}–${formatNumeric(max)}.`;
    }
    return `This study focuses on values between ${formatNumeric(min)} and ${formatNumeric(max)}.`;
  }

  if (min !== undefined) {
    if (mentionsAge) {
      return `This study is for participants age ${formatNumeric(min)} or older.`;
    }
    return `This question looks for values of ${formatNumeric(min)} or higher.`;
  }

  if (max !== undefined) {
    if (mentionsAge) {
      return `This study is for participants age ${formatNumeric(max)} or younger.`;
    }
    return `This question looks for values up to ${formatNumeric(max)}.`;
  }

  return null;
}

function EnhancedLabel({ question }: { question: UiQuestion }) {
  return <span>{question.label}</span>;
}

function getWhyContent(question: UiQuestion): string {
  return question.helperText ?? "";
}

function pickAffirmation(status: CompletionStatus) {
  if (status !== "provided") return STATUS_AFFIRMATIONS[status];
  return AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)];
}

function getReassurance(question: UiQuestion, status: CompletionStatus) {
  if (status !== "provided") {
    return "Your comfort comes first — you can pause or revisit any answer.";
  }
  const text = question.label.toLowerCase();
  if (SENSITIVE_KEYWORDS.some((kw) => text.includes(kw))) {
    return "This helps us avoid conflicts with current meds or conditions your clinician is watching.";
  }
  return "Used only to find suitable studies. You can edit or delete anytime.";
}

function makeNumberSchema(label: string, required: boolean, bounds?: NumberBounds) {
  let schema: z.ZodTypeAny = z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    const n = Number(val);
    return Number.isFinite(n) ? n : val;
  }, z.number());

  if (!required) {
    schema = schema.optional();
  } else {
    schema = schema.refine((v: unknown) => v !== undefined, { message: `${label} is required` });
  }

  schema = schema.refine((v: unknown) => v === undefined || typeof v === "number", { message: `${label} must be a number` });

  const minValue = typeof bounds?.min === "number" ? bounds.min : undefined;
  const maxValue = typeof bounds?.max === "number" ? bounds.max : undefined;
  const minInclusive = bounds?.minInclusive !== undefined ? bounds?.minInclusive : true;
  const maxInclusive = bounds?.maxInclusive !== undefined ? bounds?.maxInclusive : true;

  if (typeof minValue === "number") {
    schema = schema.refine(
      (v: unknown) =>
        v === undefined ||
        (typeof v === "number" &&
          (minInclusive ? v >= minValue : v > minValue)),
      {
        message: minInclusive
          ? `${label} must be at least ${minValue}`
          : `${label} must be greater than ${minValue}`,
      },
    );
  }
  if (typeof maxValue === "number") {
    schema = schema.refine(
      (v: unknown) =>
        v === undefined ||
        (typeof v === "number" &&
          (maxInclusive ? v <= maxValue : v < maxValue)),
      {
        message: maxInclusive
          ? `${label} must be ${maxValue} or less`
          : `${label} must be less than ${maxValue}`,
      },
    );
  }

  return schema;
}

function runNumberSchemaSelfTests() {
  const report = (condition: boolean, message: string) => {
    if (!condition && typeof console !== "undefined") {
      console.warn(`[screener:number-schema] ${message}`);
    }
  };

  const inclusiveRange = makeNumberSchema("Age", true, { min: 18, max: 49 });
  report(inclusiveRange.safeParse(49).success, "Expected age 49 to satisfy range 18–49");
  report(!inclusiveRange.safeParse(50).success, "Expected age 50 to violate range 18–49");

  const maxOnly = makeNumberSchema("Score", true, { max: 10 });
  report(maxOnly.safeParse(10).success, "Expected score 10 to satisfy ≤10");
  report(!maxOnly.safeParse(11).success, "Expected score 11 to violate ≤10");

  const minOnly = makeNumberSchema("Count", true, { min: 5 });
  report(minOnly.safeParse(5).success, "Expected count 5 to satisfy ≥5");
  report(!minOnly.safeParse(4).success, "Expected count 4 to violate ≥5");
}

if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
  runNumberSchemaSelfTests();
}

function getValidationSchema(question: UiQuestion) {
  const isRequired = question.clause.critical || question.clause.type === "inclusion";

  const kind = getQuestionKind(question);

  switch (kind) {
    case "number":
      return makeNumberSchema(question.label, isRequired, extractNumberBounds(question));
    case "boolean":
      if (!isRequired) {
        return z.preprocess((val) => {
          if (val === null || val === undefined) return undefined;
          return val === true || val === "true";
        }, z.boolean().optional());
      }
      return z.preprocess((val) => val === true || val === "true", z.literal(true).or(z.literal(false)));
    case "choice":
      if (!isRequired) {
        return z.any().optional();
      }
      return z.any().refine((val) => {
        if (Array.isArray(val)) return val.length > 0;
        return val !== undefined && val !== "";
      }, { message: `${question.label} is required` });
    default:
      return z.any();
  }
}

function validateAnswer(question: UiQuestion, value: unknown) {
  const schema = getValidationSchema(question);
  const result = schema.safeParse(value);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return firstIssue?.message || "Please review your answer.";
  }
  return null;
}

export default function Screener({
  trial,
  initialAnswers = {},
  precalculatedQuestions,
  optionalQuestions = [],
  initialProfile = null,
  onCompleted,
  onProfileCleared,
  showDebug = false,
  compact = false,
  clinicPreview = false,
}: ScreenerProps) {
  const router = useRouter();
  const isCompact = Boolean(compact);
  const mapProfileToAnswers = useCallback(
    (profile: ProfileCookie | null): AnswerMap => {
      const result: AnswerMap = {};
      if (!profile) return result;

      if (typeof profile.age === "number" && Number.isFinite(profile.age)) {
        const roundedAge = Math.round(profile.age);
        result.age_years = roundedAge;
        result.age = roundedAge;
        result.dem_age = roundedAge;
      }

      if (profile.sex === "male" || profile.sex === "female" || profile.sex === "other") {
        result.sex = profile.sex;
        result.dem_sex = profile.sex;
      }

      if (profile.pregnancy === true || profile.pregnancy === false) {
        result.pregnancy = profile.pregnancy;
        result.dem_pregnancy = profile.pregnancy;
      }

      const normalizedSlug =
        typeof trial.conditionSlug === "string" && trial.conditionSlug.trim().length > 0
          ? trial.conditionSlug.trim().toLowerCase()
          : null;

      if (normalizedSlug) {
        const hasCondition = Array.isArray(profile.conditions)
          ? profile.conditions.some(
            (entry) => typeof entry === "string" && entry.trim().toLowerCase() === normalizedSlug,
          )
          : false;
        result.diagnosis = hasCondition ? true : null;
      } else {
        result.diagnosis = null;
      }

      return result;
    },
    [trial.conditionSlug],
  );

  const profileSeed = useMemo(() => mapProfileToAnswers(initialProfile ?? null), [initialProfile, mapProfileToAnswers]);
  const initialAnswerMap = useMemo(() => buildInitialAnswerMap(initialAnswers), [initialAnswers]);

  const [answers, setAnswers] = useState<Record<string, unknown>>(() => ({
    ...profileSeed,
    ...initialAnswers,
  }));

  const [prefillSources, setPrefillSources] = useState<Record<string, "profile" | "prefill">>(() => {
    const base: Record<string, "profile" | "prefill"> = {};
    Object.keys(profileSeed).forEach((id) => {
      if (profileSeed[id] !== undefined) {
        base[id] = "profile";
      }
    });
    Object.entries(initialAnswers).forEach(([id, value]) => {
      if (value !== undefined) {
        base[id] = "prefill";
      }
    });
    return base;
  });

  const [completion, setCompletion] = useState<Record<string, CompletionStatus>>(() => {
    const base: Record<string, CompletionStatus> = {};
    Object.entries(profileSeed).forEach(([id, value]) => {
      if (value === undefined) return;
      base[id] = value === null ? "unsure" : "provided";
    });
    Object.entries(initialAnswers).forEach(([id, value]) => {
      if (value === undefined) return;
      base[id] = value === null ? "unsure" : "provided";
    });
    return base;
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [flowState, setFlowState] = useState<"collecting" | "acknowledging" | "evaluating" | "promising" | "notAFit">("collecting");
  // Adaptive screener state
  const [pendingLikelyStop, setPendingLikelyStop] = useState(false);
  const [interimResult, setInterimResult] = useState<EvaluationResult | null>(null);
  const [recentNote, setRecentNote] = useState<{ affirmation: string; why: string; reassurance: string } | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [draftValue, setDraftValue] = useState<unknown>(undefined);
  const [pauseMessage, setPauseMessage] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [initialIndexLocked, setInitialIndexLocked] = useState(false);
  const [whyDisclosure, setWhyDisclosure] = useState<Record<string, boolean>>({});
  const previousQuestionIdRef = useRef<string | null>(null);
  const autoAdvancedRef = useRef<Set<string>>(new Set());
  const reportTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportQuestionId, setReportQuestionId] = useState<string | null>(null);
  const [reportNote, setReportNote] = useState("");
  const [reportError, setReportError] = useState<string | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const reportTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const activeInputRef = useRef<HTMLInputElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const markQuestionTouched = useCallback(
    (id: string) => setTouched((prev) => ({ ...prev, [id]: true })),
    [],
  );
  const resetReportState = useCallback(() => {
    setReportNote("");
    setReportError(null);
    setReportSuccess(false);
  }, []);
  const closeReportModal = useCallback(() => {
    if (reportTimeoutRef.current) {
      clearTimeout(reportTimeoutRef.current);
      reportTimeoutRef.current = null;
    }
    setShowReportModal(false);
    setReportQuestionId(null);
    resetReportState();
  }, [resetReportState]);

  const debugQuestionLogRef = useRef<string | null>(null);

  const screenerData = useMemo(() => {
    if (!Array.isArray(precalculatedQuestions)) return null;
    const orderedQuestions = precalculatedQuestions.filter((question): question is UiQuestion => Boolean(question));
    const patientQuestions = orderedQuestions.filter(
      (question) => question.sourceTag !== CLINIC_TAG && question.kind !== "heading",
    );
    const clinicChecks = orderedQuestions
      .filter((question) => question.sourceTag === CLINIC_TAG)
      .map((question) => ({
        id: question.id,
        label: question.label,
        clause: question.clause,
        helperText: question.helperText,
        sourceTag: question.sourceTag,
      }));

    return {
      orderedQuestions,
      patientQuestions,
      clinicChecks,
      questionnaire: {
        include: patientQuestions,
        exclude: [],
      },
    };
  }, [precalculatedQuestions]);

  const questionnaire = screenerData?.questionnaire ?? { include: [], exclude: [] };
  const orderedQuestions = screenerData?.orderedQuestions ?? [];
  const headingMap = useMemo(() => {
    const map = new Map<string, string>();
    let currentHeading: { label: string; remaining: number } | null = null;
    orderedQuestions.forEach((item) => {
      if (item.kind === "heading") {
        if (item.label) {
          currentHeading = { label: item.label, remaining: 4 };
        } else {
          currentHeading = null;
        }
        return;
      }
      if (item.sourceTag !== CLINIC_TAG && currentHeading && currentHeading.remaining > 0) {
        map.set(item.id, currentHeading.label);
        currentHeading.remaining -= 1;
        if (currentHeading.remaining <= 0) {
          currentHeading = null;
        }
      }
    });
    return map;
  }, [orderedQuestions]);

  const [debugMode] = useState(() => {
    if (typeof window === "undefined") return showDebug;
    const q = new URLSearchParams(window.location.search).get("debug") === "1";
    return process.env.NODE_ENV !== "production" && (showDebug || q);
  });

  const patientQuestions = screenerData?.patientQuestions ?? [];

  // Filter out pregnancy/breastfeeding questions for males
  const criteria: UiQuestion[] = useMemo(() => {
    const sexAnswer = answers.sex ?? answers.dem_sex ?? answers.sex_at_birth;
    const isMale = typeof sexAnswer === 'string' && sexAnswer.toLowerCase() === 'male';

    if (!isMale) return patientQuestions;

    return patientQuestions.filter((q) => {
      const labelLower = (q.label ?? '').toLowerCase();
      const idLower = (q.id ?? '').toLowerCase();
      const combined = labelLower + ' ' + idLower;

      // Skip pregnancy and breastfeeding questions for males
      if (combined.includes('pregnan') || combined.includes('breastfeed') || combined.includes('nursing') || combined.includes('lactating')) {
        return false;
      }
      return true;
    });
  }, [patientQuestions, answers]);

  // Filter pregnancy/breastfeeding from clinic questions for males
  const clinicQuestions = useMemo(() => {
    const raw = screenerData?.clinicChecks ?? [];
    const sexAnswer = answers.sex ?? answers.dem_sex ?? answers.sex_at_birth;
    const isMale = typeof sexAnswer === 'string' && sexAnswer.toLowerCase() === 'male';

    if (!isMale) return raw;

    return raw.filter((q) => {
      const labelLower = (q.label ?? '').toLowerCase();
      const idLower = (q.id ?? '').toLowerCase();
      const combined = labelLower + ' ' + idLower;
      return !combined.includes('pregnan') && !combined.includes('breastfeed') && !combined.includes('nursing') && !combined.includes('lactating');
    });
  }, [screenerData?.clinicChecks, answers]);

  const clinicOnlyCount = clinicQuestions.length;
  const patientCount = criteria.length;
  const showClinicHint = !clinicPreview && clinicOnlyCount > 0;

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const total = criteria.length + clinicQuestions.length;
    console.info("[ScreenerFilter]", {
      total,
      patient: criteria.length,
      clinic: clinicQuestions.length,
      samplePatient: criteria.slice(0, 3).map((q) => ({
        id: q.id,
        kind: q.kind,
        sourceTag: q.sourceTag,
      })),
      sampleClinic: clinicQuestions.slice(0, 3).map((item) => ({
        id: item.id,
        sourceTag: item.sourceTag,
      })),
    });
  }, [clinicQuestions, criteria]);

  const totalSteps = criteria.length;
  const currentQuestion = criteria[stepIndex] ?? criteria[criteria.length - 1];
  const activeHeading = currentQuestion ? headingMap.get(currentQuestion.id) : null;
  if (currentQuestion && process.env.NODE_ENV !== "production") {
    console.info("[ActiveClause]", {
      id: currentQuestion.id,
      label: currentQuestion.label,
      kind: currentQuestion.kind,
      rule: currentQuestion.clause?.rule,
      sourceTag: currentQuestion.sourceTag,
    });
  }
  const kindForActive = currentQuestion ? getQuestionKind(currentQuestion) : undefined;
  const currentQuestionId = currentQuestion?.id;
  const currentWhy = useMemo(
    () => (currentQuestion ? getWhyContent(currentQuestion) : ""),
    [currentQuestion],
  );
  const allowSkip = currentQuestion ? isMultiSelectQuestion(currentQuestion) : false;
  // Don't show global "I'm not sure" button if question already has uncertainty option
  const hasBuiltInUnsure = useMemo(() => {
    if (!currentQuestion?.options) return false;
    return currentQuestion.options.some(opt =>
      /not\s*sure|unsure|don['']t\s*know|maybe/i.test(opt)
    );
  }, [currentQuestion]);
  const isWhyOpen = currentQuestionId ? whyDisclosure[currentQuestionId] ?? false : false;
  const rangeDescription = useMemo(() => getRangeDescription(currentQuestion), [currentQuestion]);
  const questionLabelId = currentQuestionId ? `question-label-${currentQuestionId}` : undefined;
  const whyContentId = currentQuestionId ? `why-${currentQuestionId}` : undefined;
  const controlId = currentQuestionId ? `response-${currentQuestionId}` : undefined;
  const numberInputId = controlId ?? (currentQuestionId ? `${currentQuestionId}-input` : undefined);
  const isCurrentTouched = currentQuestionId ? Boolean(touched[currentQuestionId]) : false;
  const currentError = currentQuestion ? validationErrors[currentQuestion.id] : null;
  const showValidationError = Boolean(currentError && flowState === "collecting" && isCurrentTouched);
  const currentPrefillSource = currentQuestionId ? prefillSources[currentQuestionId] : undefined;
  const easeOutCurve: [number, number, number, number] = [0.16, 1, 0.3, 1];
  const easeInCurve: [number, number, number, number] = [0.4, 0, 1, 1];
  const motionVariants = prefersReducedMotion
    ? {
      initial: { opacity: 1, y: 0 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 0 },
    }
    : {
      initial: { opacity: 1, y: 8 },
      animate: { opacity: 1, y: 0, transition: { duration: 0.15, ease: easeOutCurve } },
      exit: { opacity: 0, y: 8, transition: { duration: 0.12, ease: easeInCurve } },
    };
  const reportedQuestion = useMemo(
    () => reportQuestionId ? criteria.find((entry) => entry.id === reportQuestionId) ?? null : null,
    [criteria, reportQuestionId],
  );
  const toggleWhyDisclosure = useCallback(() => {
    if (!currentQuestionId) return;
    setWhyDisclosure((prev) => {
      const next = { ...prev };
      next[currentQuestionId] = !(prev[currentQuestionId] ?? false);
      return next;
    });
  }, [currentQuestionId]);

  useEffect(() => {
    if (!debugMode) return;
    const el =
      (typeof document !== "undefined" &&
        (document.querySelector('[data-testid="pm-input-ui"]') ||
          document.querySelector('[data-testid="pm-input-native"]'))) ||
      null;
    const box = el?.getBoundingClientRect() ?? null;
    if (typeof console !== "undefined") {
      console.info("[ScreenerDebug] Input bbox", box);
    }
    const overlay =
      typeof document !== "undefined"
        ? (document.querySelector('[data-testid="clinic-hint"]') as HTMLElement | null)
        : null;
    const box2 = overlay?.getBoundingClientRect() ?? null;
    if (typeof console !== "undefined") {
      console.info(
        "[ScreenerDebug] Clinic hint bbox",
        box2,
        "styles",
        overlay ? window.getComputedStyle(overlay).zIndex : null,
      );
    }
  }, [currentQuestion, debugMode]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (typeof window === "undefined") return;
    if (!currentQuestion) return;
    if (patientQuestions.length === 0) return;
    const el = document.querySelector('[data-testid="pm-input-ui"]') as HTMLElement | null;
    if (!el) {
      console.warn("[ScreenerInputMissing]", { id: currentQuestion.id });
      return;
    }
    const styles = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    (window as typeof window & { __pm_last_bbox__?: DOMRect }).__pm_last_bbox__ = rect;
    const visible =
      styles.visibility !== "hidden" &&
      styles.opacity !== "0" &&
      styles.display !== "none" &&
      rect.height > 0 &&
      rect.width > 0;
    if (!visible) {
      console.warn("[ScreenerInputNotVisible]", { styles, bbox: rect, id: currentQuestion.id });
    }
  }, [currentQuestion, patientQuestions.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV === "production") return;
    if (!currentQuestion || getQuestionKind(currentQuestion) !== "number") return;
    const inputEl = activeInputRef.current;
    if (!inputEl) return;

    const applyContrastCheck = () => {
      const computed = window.getComputedStyle(inputEl);
      const boxShadow = (computed.boxShadow || "").trim();
      const borderColor = (computed.borderColor || "").trim();
      const borderTransparent =
        borderColor.length === 0 ||
        borderColor === "transparent" ||
        borderColor === "rgba(0, 0, 0, 0)" ||
        /rgba\([^)]*,\s*0\)/.test(borderColor);

      if ((boxShadow === "" || boxShadow === "none" || borderTransparent) && inputEl.dataset.pmContrastFix !== "1") {
        inputEl.dataset.pmContrastFix = "1";
        inputEl.classList.add("ring-1", "ring-muted-foreground/30");
        console.warn("[InputContrastAutoFix]", {
          id: currentQuestion.id,
          boxShadow,
          borderColor,
        });
      }
    };

    const raf = window.requestAnimationFrame(applyContrastCheck);
    return () => window.cancelAnimationFrame(raf);
  }, [currentQuestion, currentQuestionId]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (typeof document === "undefined") return;
    const input = document.querySelector('[data-testid="pm-input-container"]') as HTMLElement | null;
    const hint = document.querySelector('[data-testid="clinic-hint"]') as HTMLElement | null;
    if (!input || !hint) return;
    const r1 = input.getBoundingClientRect();
    const r2 = hint.getBoundingClientRect();
    const overlapWidth = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
    const overlapHeight = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top));
    const overlap = overlapWidth * overlapHeight;
    if (overlap > 0) {
      hint.classList.add("mt-2", "opacity-90");
      const marker = (window as typeof window & { __clinicHintShifted?: boolean });
      if (!marker.__clinicHintShifted && typeof console !== "undefined") {
        console.info("[ClinicHintAutoShift]", { overlap });
        marker.__clinicHintShifted = true;
      }
    }
  }, [currentQuestionId]);

  useEffect(() => {
    if (!debugMode) return;
    if (!currentQuestion) return;
    const questionId = currentQuestion.id;
    if (!questionId) return;
    if (debugQuestionLogRef.current === questionId) return;
    debugQuestionLogRef.current = questionId;
    const payload = {
      criterion_id: currentQuestion.clause?.criterion_id ?? questionId,
      sourceTag: currentQuestion.sourceTag,
      kind: currentQuestion.kind,
      type: (currentQuestion as Record<string, unknown>).type,
      inputType: (currentQuestion as Record<string, unknown>).inputType,
      resolvedKind: getQuestionKind(currentQuestion),
    };
    console.info("[ScreenerDebug] ActiveQuestion", payload);
  }, [currentQuestion, debugMode]);

  // Seed completion if initial answers provided (e.g., from prefill)
  useEffect(() => {
    if (!initialAnswers || Object.keys(initialAnswers).length === 0) return;
    if (!criteria.length) return;

    const matchedIds: string[] = [];
    const resolvedValues: Record<string, unknown> = {};

    criteria.forEach((question) => {
      const value = resolveInitialAnswerForQuestion(question, initialAnswerMap);
      if (value !== undefined) {
        matchedIds.push(question.id);
        resolvedValues[question.id] = value;
      }
    });

    if (matchedIds.length === 0) return;

    setPrefillSources((prev) => {
      const next = { ...prev };
      matchedIds.forEach((id) => {
        next[id] = "prefill";
      });
      return next;
    });
    setCompletion((prev) => {
      const next = { ...prev };
      matchedIds.forEach((id) => {
        const value = resolvedValues[id];
        next[id] = value === null ? "unsure" : "provided";
      });
      return next;
    });
    setAnswers((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.entries(resolvedValues).forEach(([id, value]) => {
        if (next[id] === undefined) {
          next[id] = value;
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    setInitialIndexLocked(true);
    const firstIncomplete = criteria.findIndex((q) => !matchedIds.includes(q.id));
    if (firstIncomplete >= 0) {
      setStepIndex(firstIncomplete);
    } else if (criteria.length > 0) {
      setStepIndex(criteria.length - 1);
    }
  }, [criteria, initialAnswerMap, initialAnswers]);

  useEffect(() => {
    if (!profileSeed || Object.keys(profileSeed).length === 0) return;

    setAnswers((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.entries(profileSeed).forEach(([id, value]) => {
        if (value === undefined) return;
        if (next[id] === undefined) {
          next[id] = value;
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    setPrefillSources((prev) => {
      let changed = false;
      const next = { ...prev };

      Object.keys(next).forEach((id) => {
        if (next[id] === "profile" && profileSeed[id] === undefined) {
          delete next[id];
          changed = true;
        }
      });

      Object.entries(profileSeed).forEach(([id, value]) => {
        if (value === undefined) return;
        if (!next[id]) {
          next[id] = "profile";
          changed = true;
        }
      });

      return changed ? next : prev;
    });

    setCompletion((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.entries(profileSeed).forEach(([id, value]) => {
        if (value === undefined) return;
        if (!next[id]) {
          next[id] = value === null ? "unsure" : "provided";
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [profileSeed]);

  const deriveProfileAnswerForQuestion = useCallback(
    (question: UiQuestion, seed: AnswerMap): unknown => {
      const variable = (question.clause.rule?.variable ?? question.clause.rule?.field ?? "").toString().toLowerCase();
      const id = question.id.toLowerCase();
      const label = (question.label ?? "").toLowerCase();
      const kind = getQuestionKind(question);

      const ageValue = seed.dem_age ?? seed.age_years ?? seed.age;
      if (ageValue !== undefined && (variable.includes("age") || id.includes("age") || label.includes("age"))) {
        return ageValue;
      }

      const sexValue = seed.dem_sex ?? seed.sex ?? seed.gender;
      if (
        sexValue !== undefined &&
        (variable.includes("sex") || variable.includes("gender") || id.includes("sex") || id.includes("gender") || label.includes("sex"))
      ) {
        if (kind === "choice") return String(sexValue);
        return sexValue;
      }

      const pregValue = seed.dem_pregnancy ?? seed.pregnancy;
      if (
        pregValue !== undefined &&
        (variable.includes("pregnan") || id.includes("pregnan") || label.includes("pregnan"))
      ) {
        return pregValue;
      }

      return undefined;
    },
    [],
  );

  useEffect(() => {
    if (!patientQuestions.length) return;
    setAnswers((prev) => {
      let changed = false;
      const next = { ...prev };
      patientQuestions.forEach((question) => {
        if (next[question.id] !== undefined) return;
        const value = deriveProfileAnswerForQuestion(question, profileSeed);
        if (value !== undefined) {
          next[question.id] = value;
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    setCompletion((prev) => {
      let changed = false;
      const next = { ...prev };
      patientQuestions.forEach((question) => {
        if (next[question.id]) return;
        const value = deriveProfileAnswerForQuestion(question, profileSeed);
        if (value !== undefined) {
          next[question.id] = value === null ? "unsure" : "provided";
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    setPrefillSources((prev) => {
      let changed = false;
      const next = { ...prev };
      patientQuestions.forEach((question) => {
        if (next[question.id]) return;
        const value = deriveProfileAnswerForQuestion(question, profileSeed);
        if (value !== undefined) {
          next[question.id] = "profile";
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [deriveProfileAnswerForQuestion, patientQuestions, profileSeed]);

  // Hydrate from sessionStorage (ephemeral per tab)
  useEffect(() => {
    try {
      const key = `screener:${trial.nct_id}`;
      const saved = typeof window !== "undefined" ? sessionStorage.getItem(key) : null;
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (!parsed || typeof parsed !== "object") return;

      const merged: Record<string, unknown> = { ...(parsed as Record<string, unknown>) };
      Object.entries(initialAnswers).forEach(([id, value]) => {
        if (merged[id] === undefined) {
          merged[id] = value;
        }
      });

      setAnswers((prev) => {
        // Avoid overwriting if we already have richer state
        if (Object.keys(prev).length > Object.keys(merged).length) return prev;
        return merged;
      });

      const savedCompletion: Record<string, CompletionStatus> = {};
      Object.keys(merged).forEach((id) => {
        savedCompletion[id] = merged[id] === null ? "unsure" : "provided";
      });
      setCompletion((prev) => (Object.keys(prev).length > Object.keys(savedCompletion).length ? prev : savedCompletion));
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trial.nct_id]);

  useEffect(() => {
    if (initialIndexLocked || criteria.length === 0) return;
    const firstIncomplete = criteria.findIndex((q) => !completion[q.id]);
    if (firstIncomplete >= 0) {
      setStepIndex(firstIncomplete);
    }
    setInitialIndexLocked(true);
  }, [criteria, completion, initialIndexLocked]);

  // Persist autosave
  useEffect(() => {
    try {
      const key = `screener:${trial.nct_id}`;
      if (typeof window !== "undefined") {
        sessionStorage.setItem(key, JSON.stringify(answers));
      }
    } catch {
      /* ignore */
    }
  }, [answers, trial.nct_id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `screener:${trial.nct_id}`;

    const handleBeforeUnload = () => {
      try {
        sessionStorage.setItem(key, JSON.stringify(answers));
      } catch {
        /* ignore */
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [answers, trial.nct_id]);

  // Reset draft when step changes, guard against out-of-range index
  useEffect(() => {
    if (!criteria.length) return;
    if (stepIndex >= criteria.length) {
      setStepIndex(criteria.length - 1);
      return;
    }
    const current = criteria[stepIndex];
    if (!current) return;
    const existing = answers[current.id];
    const currentKind = getQuestionKind(current);
    if (existing !== undefined) {
      setDraftValue(existing);
    } else {
      setDraftValue(currentKind === "choice" && current.options.length <= 4 ? [] : "");
    }

    const previousQuestionId = previousQuestionIdRef.current;
    const questionChanged = previousQuestionId !== current.id;

    if (questionChanged) {
      setFlowState("collecting");
      setRecentNote(null);
    }

    previousQuestionIdRef.current = current.id;

    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[current.id];
      return next;
    });
  }, [criteria, stepIndex, answers]);

  useEffect(() => {
    if (!criteria.length) return;
    if (stepIndex >= criteria.length) return;
    const current = criteria[stepIndex];
    if (!current) return;

    const questionId = current.id;
    const source = prefillSources[questionId];
    const completionStatus = completion[questionId];
    const candidateValue = answers[questionId];

    const hasPrefill =
      source === "profile" || source === "prefill" || completionStatus === "provided";

    if (!hasPrefill) return;
    if (candidateValue === undefined) return;
    if (autoAdvancedRef.current.has(questionId)) return;

    const validationError = validateAnswer(current, candidateValue);
    if (validationError) return;

    autoAdvancedRef.current.add(questionId);

    if (completionStatus !== "provided") {
      setCompletion((prev) => ({ ...prev, [questionId]: "provided" }));
    }

    setAnswers((prev) => ({ ...prev, [questionId]: candidateValue }));
    setFlowState("collecting");
    setRecentNote(null);
    setDraftValue(candidateValue);

    setTimeout(() => {
      setStepIndex((prev) => {
        const nextIndex = prev + 1;
        return criteria.length === 0 ? prev : Math.min(nextIndex, Math.max(criteria.length - 1, 0));
      });
    }, 0);
  }, [answers, completion, criteria, prefillSources, stepIndex]);

  // Helper to compute display progress
  const answeredCount = useMemo(() => Object.keys(completion).length, [completion]);
  const progressValue = totalSteps === 0 ? 100 : Math.round((Math.min(stepIndex + (flowState === "acknowledging" ? 1 : 0), totalSteps) / totalSteps) * 100);
  const displayStep = Math.min(stepIndex + 1, totalSteps);
  const progressMicrocopy = totalSteps > 0 ? `Step ${Math.min(displayStep, totalSteps)} of ${totalSteps}` : "";
  const actionRowStack = isCompact ? "max-[380px]:flex-col max-[380px]:items-stretch" : "";
  const actionButtonStack = isCompact ? "max-[380px]:w-full" : "";

  const setAnswerStatus = useCallback(
    (question: UiQuestion, status: CompletionStatus, value?: unknown) => {
      const questionId = question.id;
      setErrorMsg(null);
      setCompletion((prev) => ({ ...prev, [questionId]: status }));
      setAnswers((prev) => {
        const next = { ...prev };
        if (status === "provided") {
          next[questionId] = value;
        } else if (status === "unsure") {
          next[questionId] = null;
        } else {
          delete next[questionId];
        }
        return next;
      });

      setRecentNote({
        affirmation: pickAffirmation(status),
        why: getWhyContent(question),
        reassurance: getReassurance(question, status),
      });
      setFlowState("acknowledging");
      if (status !== "provided") {
        setDraftValue(undefined);
      }
    },
    [],
  );

  const isDraftReady = () => {
    if (draftValue === undefined || draftValue === null) return false;
    if (typeof draftValue === "string") return draftValue.trim().length > 0;
    if (Array.isArray(draftValue)) return draftValue.length > 0;
    return true;
  };

  const handleSave = useCallback(() => {
    if (!currentQuestion) return;
    const error = validateAnswer(currentQuestion, draftValue);
    if (error) {
      markQuestionTouched(currentQuestion.id);
      setValidationErrors((prev) => ({ ...prev, [currentQuestion.id]: error }));
      activeInputRef.current?.focus();
      return;
    }

    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[currentQuestion.id];
      return next;
    });

    const currentKind = getQuestionKind(currentQuestion);

    let preparedValue: unknown = draftValue;
    if (currentKind === "number" && typeof draftValue === "string") {
      preparedValue = draftValue === "" ? undefined : Number(draftValue);
    } else if (currentKind === "choice" && currentQuestion.options.length <= 4) {
      if (Array.isArray(draftValue)) {
        preparedValue = draftValue;
      } else if (draftValue) {
        preparedValue = [String(draftValue)];
      } else {
        preparedValue = [];
      }
    }

    // On last question, skip acknowledgement and go directly to evaluation
    const isLastQuestion = stepIndex >= totalSteps - 1;
    if (isLastQuestion) {
      // Save the answer first
      setCompletion((prev) => ({ ...prev, [currentQuestion.id]: "provided" }));
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: preparedValue }));
      // Set evaluating state - will trigger evaluation via onComplete
      setFlowState("evaluating");
    } else {
      setAnswerStatus(currentQuestion, "provided", preparedValue);
    }
  }, [currentQuestion, draftValue, markQuestionTouched, setAnswerStatus, stepIndex, totalSteps]);

  const handleClearAnswers = useCallback(() => {
    setAnswers({});
    setCompletion({});
    setStepIndex(0);
    setDraftValue(undefined);
    setPauseMessage(null);
    setFlowState("collecting");
    setRecentNote(null);
    setValidationErrors({});
    setWhyDisclosure({});
    setTouched({});
    setPrefillSources({});
    previousQuestionIdRef.current = null;
    closeReportModal();
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`screener:${trial.nct_id}`);
      }
    } catch {
      /* ignore */
    }
  }, [closeReportModal, trial.nct_id]);

  const handleForgetSaved = useCallback(() => {
    const profileKeys = Object.entries(prefillSources)
      .filter(([, source]) => source === "profile")
      .map(([id]) => id);

    if (profileKeys.length > 0) {
      setAnswers((prev) => {
        const next = { ...prev };
        profileKeys.forEach((id) => {
          delete next[id];
        });
        return next;
      });
      setCompletion((prev) => {
        const next = { ...prev };
        profileKeys.forEach((id) => {
          delete next[id];
        });
        return next;
      });
      setPrefillSources((prev) => {
        const next = { ...prev };
        profileKeys.forEach((id) => {
          delete next[id];
        });
        return next;
      });
    }

    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("pm_profile");
      }
    } catch {
      /* ignore */
    }

    fetch("/api/profile/clear", {
      method: "GET",
      credentials: "same-origin",
    }).catch(() => {
      /* swallow network errors */
    });

    onProfileCleared?.();
  }, [prefillSources, onProfileCleared]);

  const handleSkip = () => {
    if (!currentQuestion) return;
    setAnswerStatus(currentQuestion, "skipped");
  };

  const handleUnsure = () => {
    if (!currentQuestion) return;
    setAnswerStatus(currentQuestion, "unsure");
  };

  const evaluationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (evaluationTimeoutRef.current) {
        clearTimeout(evaluationTimeoutRef.current);
      }
    };
  }, []);

  const evaluateEligibility = useCallback(async () => {
    if (isEvaluating) return;

    const pendingCritical = criteria.filter((q) => {
      if (q.sourceTag === CLINIC_TAG) return false;
      if (!(q.clause.critical || q.clause.type === "inclusion")) return false;
      const status = completion[q.id];
      return status !== "provided" && status !== "unsure";
    });
    if (pendingCritical.length > 0) {
      const firstPending = criteria.findIndex((q) => q.id === pendingCritical[0].id);
      if (firstPending >= 0) setStepIndex(firstPending);
      setFlowState("collecting");
      setErrorMsg("We need these required details before we can check eligibility.");
      return;
    }

    setIsEvaluating(true);
    setFlowState("evaluating");
    setErrorMsg(null);

    if (evaluationTimeoutRef.current) {
      clearTimeout(evaluationTimeoutRef.current);
    }

    evaluationTimeoutRef.current = setTimeout(async () => {
      try {
        const evaluation = evaluateTrial(
          questionnaire,
          answers,
          {
            trial: {
              nct_id: trial.nct_id,
              min_age_years: trial.min_age_years ?? null,
              max_age_years: trial.max_age_years ?? null,
              gender: trial.gender ?? null,
            },
            profile: {
              conditions: trial.condition ? [trial.condition] : [],
            },
          }
        );
        onCompleted?.({ answers, evaluation });
        try {
          const key = `screener:${trial.nct_id}`;
          if (typeof window !== "undefined") {
            sessionStorage.removeItem(key);
          }
        } catch {
          /* ignore */
        }
        try {
          await logEvent("screener_completed", {
            nct_id: trial.nct_id,
            score: evaluation.score,
            result: evaluation.result,
            met_count: evaluation.met_details?.length ?? 0,
            unmet_count: evaluation.unmet_details?.length ?? 0,
            unknown_count: evaluation.unknown_details?.length ?? 0,
            ...(isCompact ? { ui: "compact" as const } : {}),
          });
          if (debugMode) {
            console.log("[screener:completion]", {
              patientQuestions: criteria.length,
              clinicQuestions: clinicQuestions.length,
              met: evaluation.met_details?.length ?? 0,
              unmet: evaluation.unmet_details?.length ?? 0,
              unknown: evaluation.unknown_details?.length ?? 0,
            });
          }
        } catch {
          /* ignore analytics failures */
        }
      } catch (error) {
        setErrorMsg("Something didn't quite work while checking eligibility. Please try again.");
        setFlowState("collecting");
      } finally {
        setIsEvaluating(false);
      }
    }, 200);
  }, [
    answers,
    completion,
    criteria,
    debugMode,
    isCompact,
    isEvaluating,
    onCompleted,
    questionnaire,
    trial,
    clinicQuestions,
    criteria,
  ]);

  // Trigger evaluation when flowState is set to 'evaluating' (from handleSave on last question)
  useEffect(() => {
    if (flowState === "evaluating") {
      evaluateEligibility();
    }
  }, [flowState, evaluateEligibility]);

  /**
   * Builds a partial questionnaire from only the questions asked so far.
   * This is critical: the evaluator returns "likely" only when there are
   * no unknowns in the evaluated set.
   */
  const buildPartialQuestionnaire = useCallback((askedQuestionIds: Set<string>) => {
    const askedQuestions = criteria.filter(q => askedQuestionIds.has(q.id));
    return {
      include: askedQuestions.filter(q => q.clause.type === "inclusion"),
      exclude: askedQuestions.filter(q => q.clause.type === "exclusion"),
    };
  }, [criteria]);

  const goToNextQuestion = useCallback(() => {
    // Get the current question that was just answered
    const currentQ = criteria[stepIndex];
    if (!currentQ) {
      if (stepIndex >= totalSteps - 1) {
        evaluateEligibility();
      }
      return;
    }

    // Build the set of asked question IDs (all up to and including current)
    const askedIds = new Set<string>();
    for (let i = 0; i <= stepIndex; i++) {
      if (criteria[i]) askedIds.add(criteria[i].id);
    }

    // Perform partial evaluation
    const partialQuestionnaire = buildPartialQuestionnaire(askedIds);
    const partialResult = evaluateTrial(partialQuestionnaire, answers, { trial });

    // Check for hard fail (exclusion triggered)
    if (partialResult.result === "no" || partialResult.triggered_excludes.length > 0) {
      setInterimResult(partialResult);
      setFlowState("notAFit");
      return;
    }

    // Check for likely result
    if (partialResult.result === "likely") {
      if (!pendingLikelyStop) {
        // First time hitting likely - ask one more question before stopping
        setPendingLikelyStop(true);
        setStepIndex((prev) => {
          if (prev >= totalSteps - 1) {
            // No more main questions - evaluate
            setInterimResult(partialResult);
            setFlowState("promising");
            return prev;
          }
          return prev + 1;
        });
        return;
      } else {
        // Already asked one extra question and still likely - stop and show promising
        setInterimResult(partialResult);
        setFlowState("promising");
        return;
      }
    }

    // If we were pending likely but dropped to possible, reset and continue
    if (pendingLikelyStop && partialResult.result === "possible") {
      setPendingLikelyStop(false);
    }

    // Normal flow: advance to next question
    setStepIndex((prev) => {
      if (totalSteps === 0) return prev;
      if (prev >= totalSteps - 1) {
        evaluateEligibility();
        return prev;
      }
      return prev + 1;
    });
  }, [answers, buildPartialQuestionnaire, criteria, evaluateEligibility, pendingLikelyStop, stepIndex, totalSteps, trial]);

  const goToPreviousQuestion = useCallback(() => {
    setStepIndex((prev) => (prev > 0 ? prev - 1 : 0));
  }, []);

  const handleEdit = () => {
    setFlowState("collecting");
    setRecentNote(null);
  };

  useEffect(() => {
    if (typeof document === "undefined") return;
    const key = `screener:${trial.nct_id}`;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        const hasProgress = Object.values(completion).some(
          (status) => status === "provided" || status === "unsure",
        );
        if (hasProgress) {
          logEvent("screener_abandoned", {
            nct_id: trial.nct_id,
            step_index: stepIndex,
            ...(isCompact ? { ui: "compact" as const } : {}),
          });
        }
        try {
          sessionStorage.setItem(key, JSON.stringify(answers));
        } catch {
          /* ignore */
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [answers, completion, isCompact, stepIndex, trial.nct_id]);

  const handlePause = useCallback(
    (navigateAway = false) => {
      const key = `screener:${trial.nct_id}`;
      try {
        if (typeof window !== "undefined") {
          sessionStorage.setItem(key, JSON.stringify(answers));
        }
        if (!navigateAway) {
          setPauseMessage("Saved. Pick up where you left off anytime.");
        }
      } catch {
        if (!navigateAway) {
          setPauseMessage("We keep your answers locally so you can resume later.");
        }
      }
      if (navigateAway) {
        router.push("/trials");
      }
    },
    [answers, router, trial.nct_id],
  );

  const openReportModal = useCallback(() => {
    if (!currentQuestionId) return;
    resetReportState();
    setReportQuestionId(currentQuestionId);
    setShowReportModal(true);
  }, [currentQuestionId, resetReportState]);

  const handleReportSubmit = useCallback(async () => {
    if (!reportQuestionId) {
      setReportError("Please reopen this panel while a question is selected.");
      return;
    }

    const note = reportNote.trim();
    if (note.length < 5) {
      setReportError("Add a brief note so we know what feels off.");
      return;
    }

    setIsReporting(true);
    setReportError(null);
    try {
      const response = await fetch("/api/analytics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event: "screener_flag",
          props: {
            nct_id: trial.nct_id,
            question_id: reportQuestionId,
            note,
          },
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to submit flag");
      }
      setReportSuccess(true);
      if (reportTimeoutRef.current) {
        clearTimeout(reportTimeoutRef.current);
      }
      reportTimeoutRef.current = setTimeout(() => {
        closeReportModal();
      }, 900);
    } catch (error) {
      setReportError("Something went wrong. Please try again soon.");
    } finally {
      setIsReporting(false);
    }
  }, [closeReportModal, reportNote, reportQuestionId, trial.nct_id]);

  useEffect(() => {
    if (!showReportModal) return;
    if (typeof window === "undefined") return;
    const frame = window.requestAnimationFrame(() => {
      reportTextareaRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [showReportModal]);

  useEffect(() => {
    if (!showReportModal) return;
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeReportModal();
      }
    };
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [showReportModal, closeReportModal]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleKeydown = (event: KeyboardEvent) => {
      if (showReportModal) return;
      if (event.defaultPrevented) return;

      const active = document.activeElement as HTMLElement | null;
      const tagName = active?.tagName?.toLowerCase();
      const isInputElement =
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        active?.isContentEditable === true;

      if (event.key === "Enter" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (active && (active.tagName === "BUTTON" || active.getAttribute("role") === "button")) {
          return;
        }
        if (tagName === "textarea") {
          return;
        }
        if (isEvaluating) return;
        event.preventDefault();
        if (flowState === "acknowledging") {
          goToNextQuestion();
        } else {
          handleSave();
        }
        return;
      }

      if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (isInputElement) return;
        if (isEvaluating) return;
        event.preventDefault();
        if (event.key === "ArrowLeft") {
          goToPreviousQuestion();
        } else {
          if (flowState === "acknowledging") {
            goToNextQuestion();
          } else {
            handleSave();
          }
        }
        return;
      }

      if (event.key === "?" && !isInputElement) {
        event.preventDefault();
        toggleWhyDisclosure();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [
    showReportModal,
    isEvaluating,
    flowState,
    goToNextQuestion,
    goToPreviousQuestion,
    handleSave,
    toggleWhyDisclosure,
  ]);

  useEffect(() => {
    return () => {
      if (reportTimeoutRef.current) {
        clearTimeout(reportTimeoutRef.current);
      }
    };
  }, []);

  if (!Array.isArray(precalculatedQuestions)) {
    return (
      <div className="mx-auto max-w-md space-y-6 text-center">
        <div className="space-y-4 rounded-xl border border-border/60 bg-background/70 px-6 py-10 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
          <h3 className="text-lg font-semibold text-foreground">Configuration Error</h3>
          <p className="text-sm text-muted-foreground">
            This screener is missing its question set. Please refresh or try again later.
          </p>
        </div>
      </div>
    );
  }

  if (totalSteps === 0) {
    const clinicalTrialsUrl = `https://clinicaltrials.gov/study/${encodeURIComponent(trial.nct_id)}`;
    return (
      <div className="mx-auto max-w-md space-y-6 text-center">
        <div className="space-y-4 rounded-xl border border-border/60 bg-background/70 px-6 py-10 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
          <h3 className="text-lg font-semibold text-foreground">Nothing to answer here.</h3>
          <p className="text-sm text-muted-foreground">
            This study’s details are confirmed at the clinic.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button size="sm" asChild>
              <a href={clinicalTrialsUrl} target="_blank" rel="noopener noreferrer">
                Contact the site
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/trials">Back to trials</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const renderInput = (
    question: UiQuestion,
    options: {
      controlId?: string;
      describedBy?: string;
      labelId?: string;
      rangeDescription?: string | null;
      invalid?: boolean;
      inputRef?: RefObject<HTMLInputElement>;
    },
  ) => {
    const { controlId, describedBy, labelId, rangeDescription, invalid, inputRef } = options;
    const questionKind = getQuestionKind(question);

    if (
      process.env.NODE_ENV !== "production" &&
      !clinicPreview &&
      question.sourceTag !== CLINIC_TAG &&
      !questionKind
    ) {
      const fieldName =
        question.field ??
        (question.clause.rule?.variable ?? question.clause.rule?.field ?? "unknown");
      throw new Error(
        `[ScreenerGuard] Question without kind cannot render an input: ${question.id} / ${String(
          fieldName,
        )}`,
      );
    }

    if (questionKind === "boolean") {
      const current = draftValue === true ? true : draftValue === false ? false : undefined;
      return (
        <div
          className="grid gap-3 sm:grid-cols-2"
          role="radiogroup"
          aria-labelledby={labelId}
          aria-describedby={describedBy}
        >
          {[true, false].map((option) => {
            const selected = current === option;
            return (
              <button
                key={String(option)}
                id={option === true ? controlId : undefined}
                type="button"
                onClick={() => setDraftValue(option)}
                className={cn(
                  "relative z-10 inline-flex h-12 items-center justify-center gap-2 rounded-none border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 transition hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                  selected && "ring-2 ring-emerald-600 border-emerald-600 bg-emerald-50/20 text-emerald-800"
                )}
                aria-pressed={selected}
              >
                {selected && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                {option ? "Yes" : "No"}
              </button>
            );
          })}
          {question.helperText && (
            <p className="sm:col-span-2 text-xs text-muted-foreground/80">{question.helperText}</p>
          )}
        </div>
      );
    }

    if (questionKind === "number") {
      if (debugMode && typeof console !== "undefined") {
        console.info("[Render:number]", {
          id: question.clause?.criterion_id ?? question.id,
          kind: getQuestionKind(question),
        });
      }
      const rawPlaceholder = question.placeholder;
      const fallbackPlaceholder =
        rawPlaceholder ??
        (question.unit ? `Enter a number in ${question.unit}` : "Enter a number");
      const bounds = extractNumberBounds(question);
      const lo = Number.isFinite(bounds.min ?? NaN) ? (bounds.min as number) : 0;
      const hi = Number.isFinite(bounds.max ?? NaN) ? (bounds.max as number) : 120;
      if (process.env.NODE_ENV !== "production" && typeof console !== "undefined") {
        console.info("[AgeBounds]", { min: lo, max: hi, qid: question.id });
      }
      const agePlaceholderNeeded =
        (!rawPlaceholder || rawPlaceholder.trim().length === 0) &&
        ((question.clause.rule?.variable ?? question.clause.rule?.field ?? "")
          .toLowerCase()
          .includes("age") ||
          (question.label ?? "").toLowerCase().includes("age"));
      const placeholderText = agePlaceholderNeeded ? "Enter your age in years" : fallbackPlaceholder;

      return (
        <div
          data-testid="pm-input-container"
          className={cn(
            "relative z-0 space-y-2 rounded-none border border-zinc-200 bg-white p-4 shadow-sm",
            debugMode && "ring-2 ring-blue-300/40"
          )}
        >
          <ScreenerInput
            id={controlId ?? `${question.id}-input`}
            ref={inputRef ?? activeInputRef}
            type="number"
            value={draftValue === undefined || draftValue === null ? "" : String(draftValue)}
            onChange={(event) => setDraftValue(event.target.value)}
            onBlur={() => {
              if (question.id) {
                markQuestionTouched(question.id);
              }
            }}
            aria-describedby={describedBy}
            aria-invalid={invalid ? true : undefined}
            data-testid="pm-input-ui"
            placeholder={placeholderText}
            min={lo}
            max={hi}
            step={1}
            inputMode="numeric"
            className={cn(
              "relative z-10",
              "block w-full h-12 min-h-[3rem] rounded-none",
              "bg-white text-zinc-900 placeholder:text-zinc-500",
              "border border-zinc-300 shadow-sm",
              "px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              dbgInput,
            )}
          />
          {process.env.NODE_ENV !== "production" && (
            <input data-testid="pm-input-native" readOnly className="sr-only" />
          )}
          {question.unit && !isCompact && (
            <p className="text-xs text-muted-foreground/80">We use {question.unit} for this question.</p>
          )}
          {question.helperText && (!isCompact || !rangeDescription) && (
            <p className="text-xs text-muted-foreground/80">{question.helperText}</p>
          )}
        </div>
      );
    }

    if (questionKind === "choice") {
      const optionsList = question.options ?? [];
      const isMultiSelect = question.multiSelect === true;

      if (optionsList.length <= 4) {
        const currentArray = Array.isArray(draftValue)
          ? (draftValue as string[])
          : draftValue
            ? [String(draftValue)]
            : [];
        const toggleValue = (option: string) => {
          if (isMultiSelect) {
            // Multi-select: toggle on/off
            if (currentArray.includes(option)) {
              setDraftValue(currentArray.filter((item) => item !== option));
            } else {
              setDraftValue([...currentArray, option]);
            }
          } else {
            // Single-select: replace value
            setDraftValue([option]);
          }
        };
        return (
          <div
            className="grid gap-2"
            role={isMultiSelect ? "group" : "radiogroup"}
            aria-labelledby={labelId}
            aria-describedby={describedBy}
          >
            {optionsList.map((option, index) => {
              const selected = currentArray.includes(option);
              return (
                <button
                  key={option}
                  id={index === 0 ? controlId : undefined}
                  type="button"
                  onClick={() => toggleValue(option)}
                  className={cn(
                    "relative z-10 flex h-auto items-center justify-start gap-2 rounded-none border border-zinc-300 bg-white px-4 py-3 text-left text-sm font-medium text-zinc-900 transition hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                    selected && "ring-2 ring-emerald-600 border-emerald-600 bg-emerald-50/20 text-emerald-800"
                  )}
                  aria-pressed={selected}
                >
                  {selected && <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />}
                  <span>{option}</span>
                </button>
              );
            })}
            {question.helperText && <p className="text-xs text-muted-foreground/80">{question.helperText}</p>}
          </div>
        );
      }

      return (
        <div className="space-y-2">
          <select
            id={controlId}
            className="relative z-10 h-12 w-full rounded-none border border-zinc-300 bg-white px-4 text-base text-zinc-900 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            value={(draftValue as string) ?? ""}
            onChange={(event) => setDraftValue(event.target.value)}
            aria-describedby={describedBy}
            aria-labelledby={labelId}
          >
            <option value="">Select an option</option>
            {optionsList.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {question.helperText && <p className="text-xs text-muted-foreground/80">{question.helperText}</p>}
        </div>
      );
    }

    if (typeof console !== "undefined") {
      console.warn("Unknown question kind", question.clause?.criterion_id ?? question.id);
    }

    return (
      <div
        className={cn(
          "relative z-0 space-y-2 rounded-none border border-zinc-200 bg-white p-4 shadow-sm",
          debugMode && "ring-2 ring-blue-300/40"
        )}
      >
        <ScreenerInput
          id={controlId ?? `${question.id}-input`}
          ref={inputRef ?? activeInputRef}
          type="text"
          value={draftValue === undefined || draftValue === null ? "" : String(draftValue)}
          onChange={(event) => setDraftValue(event.target.value)}
          onBlur={() => {
            if (question.id) {
              markQuestionTouched(question.id);
            }
          }}
          aria-describedby={describedBy}
          aria-invalid={invalid ? true : undefined}
          placeholder="Enter your response"
          className="relative z-10"
        />
        {question.helperText && <p className="text-xs text-muted-foreground/80">{question.helperText}</p>}
      </div>
    );
  };

  const readyToContinue = isDraftReady();
  const showStickyActions = flowState === "collecting";

  return (
    <div
      className={cn(
        "relative flex flex-col gap-8",
        showStickyActions ? "pb-24 lg:pb-0" : "pb-0",
        isCompact && "px-4 sm:px-6"
      )}
    >
      <div
        className={cn(
          "grid gap-10",
          isCompact ? "" : "lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]"
        )}
      >
        {!isCompact && (
          <aside className="flex flex-col gap-6">
            <div className="space-y-4 rounded-sm border border-border bg-background/70 p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <HeartHandshake className="h-6 w-6 text-primary" aria-hidden="true" />
                Let’s make sure this study fits.
              </h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {[
                  "One question at a time",
                  "Autosaves as you go",
                  "Edit or skip anytime",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-1 h-4 w-4 text-primary" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2 rounded-sm border border-border bg-muted/40 p-6">
              <button
                type="button"
                onClick={() => handlePause()}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary transition hover:text-primary/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                <Clock3 className="h-4 w-4" aria-hidden="true" />
                Pause &amp; return later
              </button>
              {pauseMessage && <p className="text-xs text-muted-foreground">{pauseMessage}</p>}
            </div>
          </aside>
        )}

        <section className={cn("flex flex-col gap-4", isCompact && "mx-auto w-full max-w-3xl")}>
          <div className="relative overflow-hidden rounded-none bg-white/95">
            <AuroraBG
              className={cn("absolute inset-0 z-0", isCompact ? "opacity-60" : "opacity-80")}
              intensity={isCompact ? "calm" : "default"}
            />
            <div
              aria-hidden="true"
              className={cn(
                "absolute inset-0 z-10 bg-gradient-to-br from-white/90 via-white/65 to-white/35",
                isCompact && "from-white/92 via-white/72 to-white/55"
              )}
            />
            {debugMode && (
              <div className="absolute right-4 top-4 z-30 inline-flex items-center rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
                {patientCount} • {clinicOnlyCount} • {kindForActive ?? "n/a"}
              </div>
            )}
            <div className="relative z-20 flex flex-col gap-6 p-6 md:p-8">
              <div className={cn("flex flex-col gap-4", isCompact ? "gap-4" : "gap-3")}>
                <div
                  className={cn(
                    "flex",
                    isCompact ? "items-start justify-between gap-4" : "flex-col gap-3"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    {/* Step Pills Progress Indicator */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(totalSteps, 8) }).map((_, i) => {
                          const stepNum = i + 1;
                          const isCompleted = stepNum < displayStep;
                          const isCurrent = stepNum === displayStep;
                          // If more than 8 steps, show condensed view
                          if (totalSteps > 8 && i === 7) {
                            return (
                              <div key={i} className="flex items-center gap-1">
                                <span className="text-xs text-slate-400">...</span>
                                <div
                                  className={cn(
                                    "h-2 w-2 rounded-full transition-all",
                                    displayStep === totalSteps
                                      ? "bg-emerald-500 scale-110"
                                      : "bg-slate-200"
                                  )}
                                />
                              </div>
                            );
                          }
                          if (totalSteps > 8 && i > 6) return null;
                          return (
                            <div
                              key={i}
                              className={cn(
                                "h-2 w-2 rounded-full transition-all",
                                isCompleted && "bg-emerald-500",
                                isCurrent && "bg-rose-500 scale-110",
                                !isCompleted && !isCurrent && "bg-slate-200"
                              )}
                            />
                          );
                        })}
                      </div>
                      <span className="text-xs font-medium text-slate-500">
                        Step {displayStep} of {totalSteps}
                      </span>
                    </div>
                    {!isCompact && pauseMessage && (
                      <p className="mt-2 text-xs text-muted-foreground">{pauseMessage}</p>
                    )}
                  </div>
                  {isCompact && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-none border border-border/40 bg-white/80 text-muted-foreground hover:text-foreground"
                        >
                          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                          <span className="sr-only">Screener options</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-none bg-white/95 backdrop-blur-sm">
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault();
                            handlePause(true);
                          }}
                        >
                          Save & exit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault();
                            handleClearAnswers();
                          }}
                        >
                          Start over
                        </DropdownMenuItem>


                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault();
                            openReportModal();
                          }}
                        >
                          Report a question
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                {showClinicHint && (
                  <div className={cn(isCompact ? "mt-4" : "mt-3")}>
                    {isCompact ? (
                      <TooltipProvider>
                        <div
                          data-testid="clinic-hint"
                          className={cn(
                            "pointer-events-none relative z-[var(--z-hint)] flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-xs text-muted-foreground md:text-sm",
                            debugMode && "ring-1 ring-border/50",
                          )}
                        >
                          <Info className="h-4 w-4 text-primary" aria-hidden="true" />
                          <span className="flex-1">
                            {clinicOnlyCount} {clinicOnlyCount === 1 ? "item" : "items"} will be confirmed at the clinic.
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="pointer-events-auto z-[var(--z-hint-tooltip)] text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                              >
                                What does this mean?
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="end">
                              Some details are reviewed by the research team at your first visit. We won’t ask those here.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    ) : (
                      <div
                        data-testid="clinic-hint"
                        className={cn(
                          "pointer-events-none relative z-[var(--z-hint)] rounded-lg border border-border/50 bg-muted/30 px-4 py-3 text-xs text-muted-foreground",
                          debugMode && "ring-1 ring-border/50",
                        )}
                      >
                        <span className="font-medium text-foreground font-mono uppercase tracking-wider text-xs">Heads up:</span>{" "}
                        {clinicOnlyCount} question{clinicOnlyCount === 1 ? "" : "s"} will be confirmed later at the clinic. We’ll focus on what you can answer right now.
                      </div>
                    )}
                  </div>
                )}
                {!isCompact && (
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <button
                      type="button"
                      className="underline transition hover:text-foreground"
                      onClick={handleClearAnswers}
                    >
                      Clear my answers
                    </button>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      className="underline transition hover:text-foreground"
                      onClick={handleForgetSaved}
                    >
                      Forget saved answers
                    </button>
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-6">
                <div className="space-y-3">
                  {!isCompact && (
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next question</p>
                  )}
                  {progressMicrocopy && (
                    <p
                      className="text-sm font-medium text-muted-foreground"
                      role="status"
                      aria-live="polite"
                    >
                      {progressMicrocopy}
                    </p>
                  )}
                  {activeHeading && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">
                      {activeHeading}
                    </p>
                  )}
                  <label
                    id={questionLabelId}
                    htmlFor={getQuestionKind(currentQuestion) === "number" ? numberInputId : undefined}
                    className={cn(
                      "block text-xl font-semibold text-foreground md:text-2xl",
                      "max-w-[60ch] leading-snug",
                      isCompact && "text-2xl md:text-3xl"
                    )}
                  >
                    <EnhancedLabel question={currentQuestion} />
                  </label>
                  {currentPrefillSource === "profile" && (
                    <span className="mt-2 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">
                      From your earlier answers
                    </span>
                  )}
                </div>

                {showValidationError && currentError && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                    {currentError}
                  </div>
                )}

                <AnimatePresence mode="wait">
                  {flowState === "acknowledging" && recentNote ? (
                    <m.div
                      key={`ack-${currentQuestion.id}`}
                      className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-5 text-sm text-foreground"
                      {...motionVariants}
                    >
                      <p className="font-medium text-foreground">{recentNote.affirmation}</p>
                      {recentNote.why && (
                        <p className="text-muted-foreground">Why this helps: {recentNote.why}</p>
                      )}
                      <p className="text-xs text-muted-foreground/80">{recentNote.reassurance}</p>
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <Button variant="ghost" size="sm" onClick={handleEdit}>
                          Edit answer
                        </Button>
                        <Button
                          size="sm"
                          onClick={goToNextQuestion}
                          disabled={isEvaluating}
                          className={cn(
                            "relative z-10 inline-flex items-center justify-center rounded-xl px-4 h-10",
                            "bg-zinc-900 text-white hover:bg-zinc-800",
                            "border border-zinc-900"
                          )}
                        >
                          {stepIndex === totalSteps - 1 ? "See results" : "Continue"}
                        </Button>
                      </div>
                    </m.div>
                  ) : (
                    <m.div
                      key={`collect-${currentQuestion.id}`}
                      className="space-y-4"
                      {...motionVariants}
                    >
                      {renderInput(currentQuestion, {
                        controlId: numberInputId,
                        describedBy: isWhyOpen ? whyContentId : undefined,
                        labelId: questionLabelId,
                        rangeDescription,
                        invalid: showValidationError,
                        inputRef: activeInputRef,
                      })}
                      {(currentWhy || (isCompact && rangeDescription)) && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={toggleWhyDisclosure}
                            aria-expanded={isWhyOpen}
                            aria-controls={whyContentId}
                            className={cn(
                              "inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
                              "underline-offset-4 hover:underline"
                            )}
                          >
                            Why we ask
                            <ChevronDown
                              className={cn("h-4 w-4 transition-transform", isWhyOpen && "rotate-180")}
                              aria-hidden="true"
                            />
                          </button>
                          {isWhyOpen && (
                            <div
                              id={whyContentId}
                              className="mt-2 rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground"
                            >
                              {currentWhy ? <p>{currentWhy}</p> : null}
                              {isCompact && rangeDescription && (
                                <p className={cn(currentWhy ? "mt-2" : "", "text-muted-foreground")}>{rangeDescription}</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      <div
                        className={cn(
                          "hidden items-center justify-between gap-3 pt-6 lg:flex",
                          actionRowStack
                        )}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={goToPreviousQuestion}
                          disabled={stepIndex === 0 || isEvaluating}
                          className={actionButtonStack}
                        >
                          Back
                        </Button>
                        <div
                          className={cn(
                            "flex items-center gap-3",
                            actionRowStack
                          )}
                        >
                          {!hasBuiltInUnsure && (
                            <Button
                              variant="link"
                              size="sm"
                              className={cn("px-0 text-muted-foreground hover:text-foreground", actionButtonStack)}
                              onClick={handleUnsure}
                              disabled={isEvaluating}
                              title="Mark as unknown and continue"
                            >
                              I’m not sure
                            </Button>
                          )}
                          {allowSkip && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleSkip}
                              disabled={isEvaluating}
                              className={actionButtonStack}
                            >
                              Skip
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={!readyToContinue || isEvaluating}
                            className={cn(
                              "relative z-10 inline-flex items-center justify-center rounded-xl px-4 h-10",
                              "bg-zinc-900 text-white hover:bg-zinc-800",
                              "border border-zinc-900",
                              actionButtonStack
                            )}
                          >
                            Continue
                          </Button>
                        </div>
                      </div>
                    </m.div>
                  )}
                </AnimatePresence>
              </div>

              <p className="text-xs text-muted-foreground">
                Used only to find suitable studies. You can edit or delete anytime.
              </p>
            </div>
          </div>

          {flowState === "evaluating" && (
            <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              Checking your answers against the study criteria…
            </div>
          )}

          {/* Promising Match Screen */}
          {flowState === "promising" && interimResult && (() => {
            // Compute remaining main questions (not yet asked)
            const remainingMain = criteria.slice(stepIndex + 1);
            const remainingCount = remainingMain.length;
            const optionalCount = optionalQuestions.length;
            const totalRemaining = remainingCount + optionalCount;

            // Handler for inline accordion answer updates
            const handleAccordionAnswer = (questionId: string, value: unknown) => {
              setAnswers((prev) => ({ ...prev, [questionId]: value }));
              setCompletion((prev) => ({
                ...prev,
                [questionId]: value === null ? "unsure" : "provided",
              }));
            };

            // Inline question row for accordion
            const renderAccordionQuestion = (question: UiQuestion) => {
              const currentValue = answers[question.id];
              const questionKind = getQuestionKind(question);

              return (
                <div key={question.id} className="py-3 border-b border-emerald-100 last:border-b-0">
                  <p className="text-sm font-medium text-emerald-900 mb-2">{question.label}</p>
                  {questionKind === "boolean" && (
                    <div className="flex gap-2">
                      {[true, false].map((option) => (
                        <button
                          key={String(option)}
                          type="button"
                          onClick={() => handleAccordionAnswer(question.id, option)}
                          className={cn(
                            "px-4 py-2 text-sm rounded-lg border transition",
                            currentValue === option
                              ? "border-emerald-500 bg-emerald-100 text-emerald-800"
                              : "border-emerald-200 bg-white text-emerald-700 hover:border-emerald-300"
                          )}
                        >
                          {option ? "Yes" : "No"}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleAccordionAnswer(question.id, null)}
                        className={cn(
                          "px-4 py-2 text-sm rounded-lg border transition",
                          currentValue === null
                            ? "border-emerald-500 bg-emerald-100 text-emerald-800"
                            : "border-emerald-200 bg-white text-emerald-700 hover:border-emerald-300"
                        )}
                      >
                        Not sure
                      </button>
                    </div>
                  )}
                  {questionKind === "number" && (
                    <input
                      type="number"
                      value={currentValue === undefined || currentValue === null ? "" : String(currentValue)}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleAccordionAnswer(question.id, val === "" ? undefined : Number(val));
                      }}
                      placeholder="Enter a number"
                      className="w-full px-3 py-2 text-sm border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  )}
                  {questionKind === "choice" && (
                    <div className="flex flex-wrap gap-2">
                      {(question.options ?? []).map((option) => {
                        const selected = Array.isArray(currentValue)
                          ? currentValue.includes(option)
                          : currentValue === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => handleAccordionAnswer(question.id, option)}
                            className={cn(
                              "px-3 py-1.5 text-sm rounded-lg border transition",
                              selected
                                ? "border-emerald-500 bg-emerald-100 text-emerald-800"
                                : "border-emerald-200 bg-white text-emerald-700 hover:border-emerald-300"
                            )}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            };

            return (
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-8 shadow-lg">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Check className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-emerald-900">Looking like a strong match!</h2>
                  <p className="text-emerald-700 max-w-md">
                    Based on your answers so far, this study appears to be a good fit for you.
                    {interimResult.score >= 70 && ` Your match confidence is ${interimResult.score}%.`}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <Button
                      size="lg"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      asChild
                    >
                      <Link href={`/trial/${trial.nct_id}`}>See trial details</Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => {
                        setFlowState("collecting");
                        setStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
                      }}
                      className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    >
                      Answer a few more questions
                    </Button>
                  </div>
                </div>

                {/* Accordion for remaining/optional questions */}
                {totalRemaining > 0 && (
                  <div className="mt-8 border-t border-emerald-200 pt-6">
                    <Accordion type="multiple" className="w-full">
                      {remainingCount > 0 && (
                        <AccordionItem value="remaining" className="border-emerald-200">
                          <AccordionTrigger className="text-sm font-semibold text-emerald-800 hover:text-emerald-900 hover:no-underline py-3">
                            <span className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-200 text-emerald-800 text-xs font-bold">
                                {remainingCount}
                              </span>
                              Remaining screening questions
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="pt-2 pb-4">
                            <div className="bg-white/70 rounded-lg p-4">
                              {remainingMain.map(renderAccordionQuestion)}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )}
                      {optionalCount > 0 && (
                        <AccordionItem value="optional" className="border-emerald-200">
                          <AccordionTrigger className="text-sm font-semibold text-emerald-800 hover:text-emerald-900 hover:no-underline py-3">
                            <span className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-200 text-teal-800 text-xs font-bold">
                                {optionalCount}
                              </span>
                              Optional questions
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="pt-2 pb-4">
                            <div className="bg-white/70 rounded-lg p-4">
                              {optionalQuestions.map(renderAccordionQuestion)}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )}
                    </Accordion>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Not a Fit Screen */}
          {flowState === "notAFit" && interimResult && (
            <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50 p-8 shadow-lg">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center">
                  <HeartHandshake className="w-8 h-8 text-rose-500" />
                </div>
                <h2 className="text-2xl font-bold text-rose-900">This study may not be the best fit</h2>
                <p className="text-rose-700 max-w-md">
                  Based on your answers, this particular trial&apos;s requirements don&apos;t match your situation.
                  But don&apos;t worry — there are many other studies that might be right for you.
                </p>
                {interimResult.triggered_excludes.length > 0 && (
                  <div className="text-sm text-rose-600 bg-rose-100/50 rounded-lg px-4 py-2 mt-2">
                    <span className="font-medium">Reason:</span> An exclusion criterion was met
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    size="lg"
                    className="bg-rose-500 hover:bg-rose-600 text-white"
                    asChild
                  >
                    <Link href="/trials">Find other studies</Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    asChild
                    className="border-rose-300 text-rose-700 hover:bg-rose-50"
                  >
                    <Link href={`/trial/${trial.nct_id}`}>View this trial anyway</Link>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div >

      {showDebug && (
        <div className="rounded-xl border border-border/60 bg-background/70 p-4 text-xs text-muted-foreground">
          <div>Total questions: {totalSteps}</div>
          <div>Answered: {answeredCount}</div>
          <div>Current question ID: {currentQuestion.id}</div>
          <div>Clinic-only questions: {clinicOnlyCount}</div>
          <div>Completion map: {JSON.stringify(completion)}</div>
        </div>
      )
      }

      {
        showStickyActions && (
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-background/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.16)] lg:hidden">
            <div
              className={cn(
                "flex items-center justify-between gap-2",
                actionRowStack
              )}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={goToPreviousQuestion}
                disabled={stepIndex === 0 || isEvaluating}
                className={actionButtonStack}
              >
                Back
              </Button>
              <div className={cn("flex items-center gap-3", actionRowStack)}>
                {!hasBuiltInUnsure && (
                  <Button
                    variant="link"
                    size="sm"
                    className={cn("px-0 text-muted-foreground hover:text-foreground", actionButtonStack)}
                    onClick={handleUnsure}
                    disabled={isEvaluating}
                    title="Mark as unknown and continue"
                  >
                    I’m not sure
                  </Button>
                )}
                {allowSkip && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSkip}
                    disabled={isEvaluating}
                    className={actionButtonStack}
                  >
                    Skip
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!readyToContinue || isEvaluating}
                  className={cn(
                    "relative z-10 inline-flex items-center justify-center rounded-xl px-4 h-10",
                    "bg-zinc-900 text-white hover:bg-zinc-800",
                    "border border-zinc-900",
                    actionButtonStack
                  )}
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>
        )
      }

      {
        showReportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={closeReportModal}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="report-modal-title"
              className="relative z-10 w-full max-w-md rounded-xl border border-border/60 bg-background p-6 text-left shadow-[0_20px_60px_rgba(15,23,42,0.18)]"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 id="report-modal-title" className="text-lg font-semibold text-foreground">
                Report a question
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Found something confusing or inaccurate? Let us know so we can tighten this screener.
              </p>
              {reportedQuestion && (
                <p className="mt-3 text-sm font-medium text-foreground">
                  {reportedQuestion.label}
                </p>
              )}
              <label htmlFor="report-note" className="mt-4 block text-sm font-medium text-foreground">
                What feels off?
              </label>
              <textarea
                id="report-note"
                ref={reportTextareaRef}
                className="mt-2 h-28 w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                value={reportNote}
                onChange={(event) => setReportNote(event.target.value)}
                placeholder="Share a brief note"
              />
              {reportError && <p className="mt-2 text-sm text-destructive">{reportError}</p>}
              {reportSuccess && <p className="mt-2 text-sm text-emerald-600">Thanks! We’ll review this question shortly.</p>}
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={closeReportModal} disabled={isReporting}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleReportSubmit} disabled={isReporting}>
                  {isReporting ? "Sending..." : "Send report"}
                </Button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

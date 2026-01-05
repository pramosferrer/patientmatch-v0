"use client";

import type { FocusEvent, KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import ConsentModal from "@/components/ConsentModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChoiceChip } from "@/components/ui/ChoiceChip";
import { ConditionCombobox } from "@/components/ConditionCombobox";
import { cn } from "@/lib/utils";
import { CONDITIONS } from "@/shared/conditions";
import { toConditionSlug } from "@/shared/conditions-normalize";
import { ArrowRight, Check, ChevronLeft, HeartHandshake, Shield } from "lucide-react";
import AuroraBG from "@/components/AuroraBG";
import { useDebounce } from "@/hooks/useDebounce";

type StepKind = "choice" | "input" | "select";

type StepBase = {
  id: string;
  prompt: string;
  helper: string;
  why: string;
  sensitive?: boolean;
  stepKind: StepKind;
};

type NumberStep = StepBase & {
  type: "number";
  placeholder: string;
  min?: number;
  max?: number;
};

type TextStep = StepBase & {
  type: "text";
  placeholder: string;
  pattern?: RegExp;
};

type SelectOption = { value: string; label: string };

type SelectStep = StepBase & {
  type: "select";
  placeholder: string;
  options: SelectOption[];
};

type ChoiceStep = StepBase & {
  type: "choice";
  options: SelectOption[];
};

type ComboboxStep = StepBase & {
  type: "combobox";
  placeholder: string;
};

type WizardStep = NumberStep | TextStep | SelectStep | ChoiceStep | ComboboxStep;

type AnswerRecord = {
  value: unknown;
  status: string;
  updatedAt: string;
};

const STORAGE_KEY = "match_flow_v2";
const CONSENT_KEY = "pm_consent_v1";
const KEY_HINTS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
const AUTO_ADVANCE_DELAY = 180;
const SAVED_TICK_DURATION = 800;
const STEP_ARIA_SHORTCUTS = `${KEY_HINTS.join(" ")} Escape Backspace Enter`;
const KEY_TIP_STORAGE_KEY = "pm_keys_tip_seen";

function isChoiceStep(step: WizardStep | null | undefined): step is ChoiceStep {
  return step?.type === "choice";
}

function isTextStep(step: WizardStep | null | undefined): step is TextStep {
  return step?.type === "text";
}

function isNumberStep(
  step: WizardStep | null | undefined,
): step is NumberStep {
  return step?.type === "number";
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return !target.readOnly && !target.disabled;
  }
  return target.isContentEditable;
}

function validateAnswer(
  step: WizardStep,
  rawValue: string,
): { valid: boolean; value?: string | number; error?: string } {
  if (step.type === "number") {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return { valid: false, error: "You can answer, skip, or mark not sure." };
    }
    const numeric = Number(trimmed);
    if (Number.isNaN(numeric)) {
      return { valid: false, error: "Please enter a number." };
    }
    if (step.min != null && numeric < step.min) {
      return { valid: false, error: `Please enter ${step.min} or higher.` };
    }
    if (step.max != null && numeric > step.max) {
      return { valid: false, error: `Please enter ${step.max} or lower.` };
    }
    return { valid: true, value: numeric };
  }

  if (step.type === "text") {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return { valid: false, error: "You can answer, skip, or mark not sure." };
    }
    if (step.pattern && !step.pattern.test(trimmed)) {
      const message =
        step.id === "zip"
          ? "ZIP codes are five digits."
          : "Please match the requested format.";
      return { valid: false, error: message };
    }
    return { valid: true, value: trimmed };
  }

  if (step.type === "select" || step.type === "combobox") {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return { valid: false, error: "Choose an option to continue." };
    }
    return { valid: true, value: trimmed };
  }

  return { valid: false };
}

function describeAnswer(
  step: WizardStep,
  record: AnswerRecord | undefined,
  conditionMap: Map<string, string>,
): string {
  if (!record) return "Not answered yet";
  if (record.status === "skipped") return "Skipped for now";
  if (record.status === "unsure") return "Marked as not sure";
  if (record.value === "" || record.value == null) return "Not answered yet";

  if (step.type === "select") {
    const label = conditionMap.get(String(record.value));
    return label ?? String(record.value);
  }

  if (step.type === "combobox") {
    return String(record.value);
  }

  if (step.type === "choice") {
    const option = step.options?.find((opt) => opt.value === record.value);
    return option?.label ?? String(record.value);
  }

  if (step.id === "age" && typeof record.value === "number") {
    return `${record.value} years`;
  }

  return String(record.value);
}

export default function MatchPageClient({ conditions }: { conditions: any[] }) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  const [consentOpen, setConsentOpen] = useState(false);
  const [consented, setConsented] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({});
  const [pendingAnswer, setPendingAnswer] = useState<string>("");
  const [fieldError, setFieldError] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [savedTickVisible, setSavedTickVisible] = useState(false);
  const [keyTipVisible, setKeyTipVisible] = useState(false);

  const autoAdvanceRef = useRef<NodeJS.Timeout | null>(null);
  const savedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const promptRef = useRef<HTMLHeadingElement | null>(null);
  const summaryRef = useRef<HTMLHeadingElement | null>(null);

  const conditionOptions = useMemo(() => {
    const known = Array.isArray(conditions) ? conditions : [];
    const map = new Map<string, string>();
    for (const entry of known) {
      if (!entry) continue;
      const slug = String(entry.slug ?? "").trim();
      const label = String(entry.label ?? "").trim();
      if (!slug || !label) continue;
      if (!map.has(slug)) {
        map.set(slug, label);
      }
    }
    for (const fallback of CONDITIONS) {
      if (!map.has(fallback.slug)) {
        map.set(fallback.slug, fallback.label);
      }
    }
    return Array.from(map.entries())
      .map(([slug, label]) => ({ value: slug, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [conditions]);

  const conditionValueToLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of conditionOptions) {
      map.set(option.value, option.label);
    }
    return map;
  }, [conditionOptions]);

  const hasConditionOptions = conditionOptions.length > 0;

  const steps = useMemo<WizardStep[]>(() => {
    const conditionStep: WizardStep = {
      id: "condition",
      prompt: "Which condition feels most important right now?",
      helper:
        "Choose the one you want matches for today—you can add others later.",
      type: "combobox",
      placeholder: "e.g., Migraine, Diabetes...",
      why: "Trials are written for specific diagnoses, so this gets you to the right shortlist first.",
      stepKind: "select",
    };

    return [
      conditionStep,
      {
        id: "age",
        prompt: "What age should we use for matching?",
        helper: "Share the number you’re comfortable with, or skip for now.",
        type: "number",
        placeholder: "Your age",
        min: 0,
        max: 120,
        why: "Protocols list age windows to keep participants safe.",
        sensitive: true,
        stepKind: "input",
      },
      {
        id: "sex",
        prompt: "What is your sex?",
        helper: "Optional. Some studies use this for safety checks.",
        type: "choice",
        options: [
          { value: "female", label: "Female" },
          { value: "male", label: "Male" },
          { value: "intersex", label: "Intersex" },
          { value: "prefer_not", label: "Prefer not to say" },
        ],
        why: "Some protocols tailor safety checks by sex.",
        sensitive: true,
        stepKind: "choice",
      },
      {
        id: "zip",
        prompt: "Which ZIP code should we consider for visits?",
        helper: "We use this for distance only. PO boxes are fine.",
        type: "text",
        placeholder: "e.g., 94103",
        pattern: /^\d{5}$/,
        why: "Travel time affects eligibility and scheduling.",
        sensitive: true,
        stepKind: "input",
      },
      {
        id: "travel",
        prompt: "How far would you travel for a study visit?",
        helper: "This keeps the list realistic for your schedule.",
        type: "choice",
        options: [
          { value: "25", label: "Local only (up to 25 miles)" },
          { value: "75", label: "Within my region (up to ~75 miles)" },
          { value: "3000", label: "I can travel anywhere in the U.S." },
        ],
        why: "Visit plans differ for local versus destination studies.",
        stepKind: "choice",
      },
      {
        id: "modality",
        prompt: "Are remote or hybrid trials appealing?",
        helper: "Many studies now offer virtual visits. Share what works best.",
        type: "choice",
        options: [
          { value: "remote_only", label: "Yes, remote only please" },
          { value: "hybrid_ok", label: "Hybrid is fine" },
          { value: "site_ok", label: "I'm comfortable with site visits" },
          { value: "undecided", label: "Not sure yet" },
        ],
        why: "We can highlight trials that match your comfort level.",
        stepKind: "choice",
      },
      {
        id: "treatments",
        prompt: "Any current treatments we should keep in mind?",
        helper:
          "You can share details with the study nurse later if you'd prefer.",
        type: "choice",
        options: [
          { value: "yes", label: "Yes—please flag potential conflicts" },
          { value: "no", label: "No ongoing treatments right now" },
          { value: "prefer_not", label: "I'd rather not share yet" },
        ],
        why: "This helps us avoid conflicts with current meds.",
        sensitive: true,
        stepKind: "choice",
      },
      {
        id: "follow_up",
        prompt: "How should we follow up when a trial looks promising?",
        helper: "No commitments—this just shapes future reminders.",
        type: "choice",
        options: [
          { value: "email_digest", label: "Send me an email summary" },
          { value: "text_nudge", label: "Text me a quick nudge" },
          { value: "self_check", label: "I'll check the app myself" },
        ],
        why: "It keeps the next steps on your terms.",
        stepKind: "choice",
      },
    ];
  }, []);

  const totalSteps = steps.length;
  const cappedStepIndex = Math.min(stepIndex, Math.max(totalSteps - 1, 0));
  const currentStep = isComplete ? null : steps[cappedStepIndex] ?? null;
  const displayStep = isComplete
    ? totalSteps
    : Math.min(cappedStepIndex + 1, totalSteps);
  const progressValue =
    totalSteps === 0 ? 0 : Math.min(100, Math.max(0, (displayStep / totalSteps) * 100));
  const contentDisabled = !consented;

  const clearAutoAdvance = useCallback(() => {
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
  }, []);

  const scheduleAutoAdvance = useCallback(
    (delay: number) => {
      clearAutoAdvance();
      autoAdvanceRef.current = setTimeout(() => {
        autoAdvanceRef.current = null;
        setFieldError("");
        setStepIndex((prev) => {
          if (prev >= totalSteps - 1) {
            setIsComplete(true);
            return prev;
          }
          return Math.min(prev + 1, totalSteps - 1);
        });
        setPendingAnswer("");
      }, Math.max(delay, 0));
    },
    [clearAutoAdvance, totalSteps],
  );

  const showSavedTick = useCallback(() => {
    setSavedTickVisible(true);
    if (savedTimeoutRef.current) {
      clearTimeout(savedTimeoutRef.current);
    }
    savedTimeoutRef.current = setTimeout(() => {
      setSavedTickVisible(false);
      savedTimeoutRef.current = null;
    }, SAVED_TICK_DURATION);
  }, []);

  const recordAnswer = useCallback(
    (
      value: unknown,
      status: string,
      options?: { autoAdvance?: boolean; delay?: number },
    ) => {
      if (!currentStep) return;
      setAnswers((prev) => ({
        ...prev,
        [currentStep.id]: {
          value,
          status,
          updatedAt: new Date().toISOString(),
        },
      }));
      showSavedTick();
      if (options?.autoAdvance) {
        scheduleAutoAdvance(options.delay ?? 0);
      }
    },
    [currentStep, scheduleAutoAdvance, showSavedTick],
  );

  const markKeyTipSeen = useCallback(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(KEY_TIP_STORAGE_KEY, "1");
    }
    setKeyTipVisible(false);
  }, [setKeyTipVisible]);

  const handleChoiceSelect = useCallback(
    (value: string) => {
      if (!currentStep || currentStep.type !== "choice") return;
      markKeyTipSeen();
      setPendingAnswer(value);
      setFieldError("");
      recordAnswer(value, "provided", {
        autoAdvance: true,
        delay: AUTO_ADVANCE_DELAY,
      });
    },
    [currentStep, markKeyTipSeen, recordAnswer],
  );

  const handleSelectChange = useCallback(
    (value: string) => {
      if (!currentStep || (currentStep.type !== "select" && currentStep.type !== "combobox")) return;
      setPendingAnswer(value);
      setFieldError("");
      recordAnswer(value, "provided", {
        autoAdvance: true,
        delay: AUTO_ADVANCE_DELAY,
      });
    },
    [currentStep, recordAnswer],
  );

  const handleSkip = useCallback(() => {
    if (!currentStep) return;
    clearAutoAdvance();
    setPendingAnswer("");
    setFieldError("");
    recordAnswer(null, "skipped", { autoAdvance: true, delay: 0 });
  }, [clearAutoAdvance, currentStep, recordAnswer]);

  const handleUnsure = useCallback(() => {
    if (!currentStep) return;
    clearAutoAdvance();
    setPendingAnswer("");
    setFieldError("");
    recordAnswer(null, "unsure", { autoAdvance: true, delay: 0 });
  }, [clearAutoAdvance, currentStep, recordAnswer]);

  const handleBack = useCallback(() => {
    clearAutoAdvance();
    setFieldError("");
    if (isComplete) {
      setIsComplete(false);
      setPendingAnswer("");
      setStepIndex(Math.max(totalSteps - 1, 0));
      return;
    }
    setStepIndex((prev) => Math.max(prev - 1, 0));
  }, [clearAutoAdvance, isComplete, totalSteps]);

  const handleContinue = useCallback(() => {
    if (!currentStep) return;

    if (currentStep.stepKind === "input") {
      const result = validateAnswer(currentStep, pendingAnswer);
      if (!result.valid || result.value === undefined) {
        setFieldError(result.error ?? "Please provide an answer or skip.");
        return;
      }
      setFieldError("");
      recordAnswer(result.value, "provided", { autoAdvance: true, delay: 0 });
      return;
    }

    if (currentStep.stepKind === "choice" || currentStep.stepKind === "select") {
      const trimmed = (pendingAnswer ?? "").trim();
      if (!trimmed) {
        setFieldError("Choose an option to continue.");
        return;
      }
      if (currentStep.stepKind === "choice") {
        markKeyTipSeen();
      }
      setFieldError("");
      recordAnswer(trimmed, "provided", { autoAdvance: true, delay: 0 });
      return;
    }
  }, [currentStep, markKeyTipSeen, pendingAnswer, recordAnswer]);

  const handleInputBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      if (!currentStep) return;
      if (!isNumberStep(currentStep) && !isTextStep(currentStep)) return;
      const result = validateAnswer(currentStep, event.target.value);
      if (!result.valid || result.value === undefined) return;
      const existing = answers[currentStep.id];
      if (
        existing?.status === "provided" &&
        existing.value === result.value
      ) {
        return;
      }
      setFieldError("");
      recordAnswer(result.value, "provided", { autoAdvance: true, delay: 0 });
    },
    [answers, currentStep, recordAnswer],
  );

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleContinue();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        handleSkip();
        return;
      }
      if (event.key === "Backspace" && pendingAnswer === "") {
        event.preventDefault();
        handleBack();
      }
    },
    [handleBack, handleContinue, handleSkip, pendingAnswer],
  );

  const handleInputChange = useCallback((value: string) => {
    setPendingAnswer(value);
    setFieldError("");
  }, []);

  const handleReset = useCallback(() => {
    clearAutoAdvance();
    setAnswers({});
    setStepIndex(0);
    setIsComplete(false);
    setPendingAnswer("");
    setFieldError("");
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [clearAutoAdvance]);

  const handleReview = useCallback(() => {
    setIsComplete(false);
    setStepIndex(0);
  }, []);

  const goToResults = useCallback(() => {
    const conditionRecord = answers.condition;
    const ageRecord = answers.age;

    const rawCondition =
      typeof conditionRecord?.value === "string"
        ? conditionRecord.value
        : conditionRecord?.value != null
          ? String(conditionRecord.value)
          : "";
    const normalizedCondition = rawCondition
      ? toConditionSlug(rawCondition)
      : "";
    const conditionParam = normalizedCondition || rawCondition;
    const ageValue =
      typeof ageRecord?.value === "number" && !Number.isNaN(ageRecord.value)
        ? ageRecord.value
        : null;

    const params = new URLSearchParams();
    params.set("prefill", "1");
    if (conditionParam) params.set("condition", conditionParam);
    if (ageValue != null) params.set("age", String(ageValue));

    const zipRecord = answers.zip;
    if (typeof zipRecord?.value === "string" && zipRecord.value.trim()) {
      params.set("zip", zipRecord.value.trim());
    }

    const travelRecord = answers.travel;
    if (typeof travelRecord?.value === "number" && Number.isFinite(travelRecord.value)) {
      params.set("radius", String(travelRecord.value));
    } else if (typeof travelRecord?.value === "string" && travelRecord.value.trim()) {
      params.set("radius", travelRecord.value.trim());
    }

    const modalityRecord = answers.modality;
    if (typeof modalityRecord?.value === "string" && modalityRecord.value) {
      params.set("modality", modalityRecord.value);
      if (modalityRecord.value === "remote_only") {
        params.set("remote", "1");
      }
    }

    const sexRecord = answers.sex;
    if (typeof sexRecord?.value === "string" && sexRecord.value !== "prefer_not") {
      params.set("sex", sexRecord.value);
    }

    router.push(`/trials?${params.toString()}`);
  }, [answers, router]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.add("match-fullscreen");
    return () => {
      document.body.classList.remove("match-fullscreen");
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedConsent = window.localStorage.getItem(CONSENT_KEY);
      if (process.env.NODE_ENV !== "production") {
        setConsented(false);
        setConsentOpen(true);
        return;
      }
      if (storedConsent === "true") {
        setConsented(true);
        setConsentOpen(false);
      } else {
        setConsentOpen(true);
      }
    } catch {
      setConsentOpen(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const readStorage = (): { answers?: Record<string, AnswerRecord>; stepIndex?: number; isComplete?: boolean } => {
      const parse = (raw: string | null) => {
        try {
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      };
      // Prefer sessionStorage for a single-session experience; fall back to localStorage.
      const sessionData = parse(window.sessionStorage.getItem(STORAGE_KEY));
      const localData = parse(window.localStorage.getItem(STORAGE_KEY));
      return sessionData || localData || {};
    };

    const parsed = readStorage();
    if (parsed.answers) {
      setAnswers(parsed.answers);
    }
    if (typeof parsed.stepIndex === "number") {
      setStepIndex(
        Math.min(
          Math.max(parsed.stepIndex, 0),
          Math.max(steps.length - 1, 0),
        ),
      );
    }
    if (parsed.isComplete) {
      setIsComplete(true);
    }
  }, [steps.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem("pm_profile");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const candidateCondition = Array.isArray(parsed?.conditions)
        ? parsed.conditions[0]
        : typeof parsed?.condition === "string"
          ? parsed.condition
          : "";
      const candidateZip = typeof parsed?.zip === "string" ? parsed.zip : "";
      if (!candidateCondition && !candidateZip) return;

      setAnswers((prev) => {
        let changed = false;
        const next: Record<string, AnswerRecord> = { ...prev };
        const now = new Date().toISOString();

        if (!prev.condition?.value && candidateCondition) {
          next.condition = { value: String(candidateCondition), status: "provided", updatedAt: now };
          changed = true;
        }
        if (!prev.zip?.value && candidateZip) {
          next.zip = { value: candidateZip, status: "provided", updatedAt: now };
          changed = true;
        }

        return changed ? next : prev;
      });
    } catch {
      /* ignore parse errors */
    }
  }, []);

  const debouncedAnswers = useDebounce(answers, 500);
  const debouncedStepIndex = useDebounce(stepIndex, 500);
  const debouncedIsComplete = useDebounce(isComplete, 500);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = JSON.stringify({
      answers: debouncedAnswers,
      stepIndex: debouncedStepIndex,
      isComplete: debouncedIsComplete
    });
    try {
      window.localStorage.setItem(STORAGE_KEY, payload);
    } catch {
      /* ignore quota errors */
    }
    try {
      window.sessionStorage.setItem(STORAGE_KEY, payload);
    } catch {
      /* ignore quota errors */
    }
  }, [debouncedAnswers, debouncedStepIndex, debouncedIsComplete]);

  useEffect(() => {
    if (isComplete) {
      setPendingAnswer("");
      setFieldError("");
      return;
    }
    if (!currentStep) return;
    const record = answers[currentStep.id];
    if (record?.value != null) {
      if (typeof record.value === "number") {
        setPendingAnswer(String(record.value));
      } else if (typeof record.value === "string") {
        setPendingAnswer(record.value);
      } else {
        setPendingAnswer("");
      }
    } else {
      setPendingAnswer("");
    }
    setFieldError("");
  }, [answers, currentStep, isComplete]);

  useEffect(() => {
    if (consentOpen) return;
    if (isComplete) {
      if (summaryRef.current) {
        summaryRef.current.focus({ preventScroll: true });
      }
      return;
    }
    if (promptRef.current) {
      promptRef.current.focus({ preventScroll: true });
    }
  }, [consentOpen, isComplete, cappedStepIndex]);

  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      if (consentOpen || isComplete || !currentStep) return;
      if (event.key === "Escape") {
        event.preventDefault();
        handleSkip();
        return;
      }
      if (event.key === "Backspace") {
        if (
          (isChoiceStep(currentStep) && !isEditableTarget(event.target)) ||
          pendingAnswer === ""
        ) {
          event.preventDefault();
          handleBack();
        }
        return;
      }
      if (isChoiceStep(currentStep) && !isEditableTarget(event.target)) {
        const index = KEY_HINTS.indexOf(event.key as (typeof KEY_HINTS)[number]);
        if (index !== -1) {
          const option = currentStep.options?.[index];
          if (option) {
            event.preventDefault();
            markKeyTipSeen();
            handleChoiceSelect(option.value);
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [consentOpen, currentStep, handleBack, handleChoiceSelect, handleSkip, isComplete, markKeyTipSeen, pendingAnswer]);

  useEffect(() => {
    return () => {
      clearAutoAdvance();
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
        savedTimeoutRef.current = null;
      }
    };
  }, [clearAutoAdvance]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.sessionStorage.getItem(KEY_TIP_STORAGE_KEY)) {
      setKeyTipVisible(true);
    }
  }, []);

  const continueDisabled = useMemo(() => {
    if (!currentStep) return true;
    if (currentStep.stepKind === "input") {
      const result = validateAnswer(currentStep, pendingAnswer);
      return !result.valid;
    }
    if (currentStep.stepKind === "choice" || currentStep.stepKind === "select") {
      return !((pendingAnswer ?? "").trim());
    }
    return true;
  }, [currentStep, pendingAnswer]);

  const hasSelection = Boolean((pendingAnswer ?? "").trim());

  const shouldShowContinue =
    !!currentStep &&
    (currentStep.stepKind === "input" ||
      (currentStep.stepKind === "choice" && hasSelection) ||
      (currentStep.stepKind === "select" && hasSelection));

  function renderInput(step: WizardStep | null) {
    if (!step) return null;

    if (step.type === "select") {
      return (
        <div className="mt-2 max-w-lg">
          <Label className="text-sm text-muted-foreground">Choose an option</Label>
          <Select
            value={pendingAnswer || ""}
            onValueChange={handleSelectChange}
            disabled={contentDisabled}
          >
            <SelectTrigger className="mt-2 w-full">
              <SelectValue placeholder={step.placeholder} />
            </SelectTrigger>
            <SelectContent className="bg-warm-cream/95 backdrop-blur">
              {step.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (step.type === "combobox") {
      return (
        <div className="mt-2 max-w-lg">
          <Label className="text-sm text-muted-foreground">{step.helper}</Label>
          <div className="mt-2">
            <ConditionCombobox
              value={pendingAnswer}
              onChange={handleSelectChange}
            />
          </div>
        </div>
      );
    }

    if (step.type === "choice") {
      return (
        <>
          <div className="mt-2 flex flex-wrap gap-3">
            {step.options?.map((option, index) => {
              const selected = pendingAnswer === option.value;
              const keyHint = KEY_HINTS[index] ?? null;
              return (
                <ChoiceChip
                  key={option.value}
                  onClick={() => handleChoiceSelect(option.value)}
                  selected={selected}
                  disabled={contentDisabled}
                  aria-keyshortcuts={keyHint ?? undefined}
                  keyHint={keyHint ?? undefined}
                >
                  {option.label}
                </ChoiceChip>
              );
            })}
          </div>
          {keyTipVisible && currentStep?.id === step.id && (
            <p className="mt-2 text-sm text-muted-foreground">
              Tip: You can use the number keys (1–9).
            </p>
          )}
        </>
      );
    }

    if (step.type === "number") {
      return (
        <div className="mt-2 max-w-xs">
          <Label className="text-sm text-muted-foreground">Enter a number</Label>
          <Input
            type="number"
            inputMode="numeric"
            min={step.min}
            max={step.max}
            value={pendingAnswer}
            onChange={(event) => handleInputChange(event.target.value)}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            placeholder={step.placeholder}
            disabled={contentDisabled}
            className="mt-2"
          />
        </div>
      );
    }

    return (
      <div className="mt-2 max-w-xl">
        <Label className="text-sm text-muted-foreground">
          Share in your own words
        </Label>
        <Input
          value={pendingAnswer}
          onChange={(event) => handleInputChange(event.target.value)}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          placeholder={step.placeholder}
          disabled={contentDisabled}
          className="mt-2"
        />
      </div>
    );
  }

  const easeOutCurve: [number, number, number, number] = [0.16, 1, 0.3, 1];
  const contentMotion = prefersReducedMotion
    ? {}
    : {
      initial: { opacity: 0, y: 6 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -6 },
      transition: { duration: 0.28, ease: easeOutCurve },
    };

  return (
    <main className="relative min-h-screen overflow-hidden">
      <AuroraBG className="absolute inset-0 z-0 opacity-90" intensity="default" />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-10 bg-gradient-to-r from-white/80 via-white/55 to-white/20"
      />
      <Link
        href="/"
        aria-label="PatientMatch home"
        className="pointer-events-auto absolute left-4 top-4 z-30 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:left-6 sm:top-6"
      >
        <span className="text-lg font-semibold tracking-[-0.02em] text-slate-900">
          PatientMatch
        </span>
      </Link>
      <div className="relative z-20 flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div
          className={cn(
            "w-full max-w-3xl space-y-6 sm:space-y-8",
            contentDisabled && "pointer-events-none select-none opacity-60",
          )}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-medium text-muted-foreground">
              <span aria-live="polite">Step {displayStep} of {totalSteps}</span>
              <AnimatePresence>
                {savedTickVisible && (
                  <motion.span
                    key="saved-tick"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0 }
                        : { duration: 0.2, ease: easeOutCurve }
                    }
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm"
                    aria-live="polite"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Saved
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div className="h-1.5 w-full rounded-full bg-warm-rose/30">
              <motion.div
                className="h-full rounded-full bg-primary"
                style={{ width: `${progressValue}%` }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: 0.35, ease: easeOutCurve }
                }
              />
            </div>
          </div>

          <div className="space-y-6 sm:space-y-8">
            <AnimatePresence mode="wait">
              {isComplete ? (
                <motion.div
                  key="summary"
                  {...contentMotion}
                  className="flex flex-col gap-6 sm:gap-8"
                >
                  <div className="space-y-4">
                    <h1
                      ref={summaryRef}
                      tabIndex={-1}
                      className="text-3xl font-semibold leading-tight text-foreground sm:text-4xl lg:text-5xl"
                    >
                      All set. Here’s what we noted.
                    </h1>
                    <p className="text-base text-muted-foreground sm:text-lg">
                      Adjust anything before browsing trials. Nothing leaves your device until you choose to share.
                    </p>
                  </div>

                  <ul className="space-y-4">
                    {steps.map((step) => (
                      <li
                        key={step.id}
                        className="rounded-2xl border border-border/60 bg-white/70 px-4 py-3 text-sm text-muted-foreground shadow-inner"
                      >
                        <p className="font-medium text-foreground">{step.prompt}</p>
                        <p className="mt-1 text-base text-foreground/90">
                          {describeAnswer(step, answers[step.id], conditionValueToLabel)}
                        </p>
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleReset}
                      className="inline-flex items-center gap-2"
                    >
                      Start over
                    </Button>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button variant="outline" onClick={handleReview}>
                        Edit answers
                      </Button>
                      <Button
                        onClick={goToResults}
                        className="inline-flex items-center gap-2"
                      >
                        See trial suggestions
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ) : currentStep ? (
                <motion.div
                  key={currentStep.id}
                  {...contentMotion}
                  role="group"
                  aria-labelledby={`prompt-${currentStep.id}`}
                  aria-keyshortcuts={STEP_ARIA_SHORTCUTS}
                  className="flex flex-col gap-6 sm:gap-8"
                >
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-3 text-2xl font-semibold leading-tight text-foreground sm:text-3xl lg:text-5xl">
                      <HeartHandshake className="h-7 w-7 text-primary" aria-hidden="true" />
                      <h1
                        id={`prompt-${currentStep.id}`}
                        ref={promptRef}
                        tabIndex={-1}
                        className="focus:outline-none"
                      >
                        {currentStep.prompt}
                      </h1>
                    </div>
                    <p className="text-base text-muted-foreground sm:text-lg">
                      {currentStep.helper}
                    </p>
                    {currentStep.sensitive && (
                      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground sm:text-base">
                        <Shield className="h-4 w-4 text-primary" aria-hidden="true" />
                        We don’t share this without your okay.
                      </p>
                    )}
                    <p className="text-base text-muted-foreground sm:text-lg">
                      <span className="font-semibold text-foreground">Why this helps:</span>{" "}
                      {currentStep.why}
                    </p>
                  </div>

                  {renderInput(currentStep)}

                  {fieldError && (
                    <p
                      className="text-sm font-medium text-destructive"
                      role="status"
                      aria-live="polite"
                    >
                      {fieldError}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleBack}
                        disabled={stepIndex === 0}
                        aria-keyshortcuts="Backspace"
                        className="inline-flex items-center gap-2"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Back
                      </Button>
                      <button
                        type="button"
                        onClick={handleSkip}
                        className="text-sm text-muted-foreground underline underline-offset-4 transition hover:text-foreground"
                        aria-keyshortcuts="Escape"
                      >
                        Skip
                      </button>
                      <button
                        type="button"
                        onClick={handleUnsure}
                        className="text-sm text-muted-foreground underline underline-offset-4 transition hover:text-foreground"
                      >
                        I&apos;m not sure
                      </button>
                    </div>

                    {shouldShowContinue && (
                      <Button
                        type="button"
                        onClick={handleContinue}
                        disabled={continueDisabled}
                        aria-keyshortcuts="Enter"
                        className="inline-flex items-center gap-2"
                      >
                        Continue
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <ConsentModal
        open={consentOpen}
        onAgree={() => {
          try {
            if (typeof window !== "undefined") {
              window.localStorage.setItem(CONSENT_KEY, "true");
            }
          } catch {
            /* ignore */
          }
          setConsented(true);
          setConsentOpen(false);
        }}
        onDecline={() => {
          try {
            if (typeof window !== "undefined") {
              window.localStorage.setItem(CONSENT_KEY, "false");
            }
          } catch {
            /* ignore */
          }
          setConsented(false);
          setConsentOpen(false);
          router.push("/");
        }}
        onViewPolicy={() => {
          if (typeof window === "undefined") return;
          window.open("/privacy", "_blank", "noopener,noreferrer");
        }}
      />
    </main>
  );
}

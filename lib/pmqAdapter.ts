import { SourceTag, type CriteriaClause, type UiQuestion } from "./screener/types";

export interface UserProfile {
  age_years?: number | null;
  sex_at_birth?: string | null;
  zip?: string | null;
  diagnosis_confirmed?: boolean | null;
}

type PmqLogicEntry = {
  type?: string;
  section?: string;          // "inclusion" | "exclusion"
  disqualify_when?: string;  // "Yes" | "No"
  qualifies_when?: string;
  params?: Record<string, unknown>;
  [key: string]: unknown;
};

type PmqQuestion = {
  id?: string;
  key?: string;
  question_key?: string;
  text?: string;
  help_text?: string;
  options?: string[];
  clinic_only?: boolean;
  source?: string;
  answer_type?: string;
  validation?: any;
  logic?: PmqLogicEntry[];
};

export type PmqAdapterResult = {
  mainQuestions: UiQuestion[];
  optionalQuestions: UiQuestion[];
  initialAnswers: Record<string, any>;
};

function preserveCase(source: string, replacement: string): string {
  return source[0] === source[0]?.toUpperCase()
    ? `${replacement[0]?.toUpperCase() ?? ""}${replacement.slice(1)}`
    : replacement;
}

function transformForCaregiver(text: string): string {
  return text
    .replace(/\byourself\b/gi, (match) => preserveCase(match, "themselves"))
    .replace(/\byou've\b/gi, (match) => preserveCase(match, "they've"))
    .replace(/\byou're\b/gi, (match) => preserveCase(match, "they're"))
    .replace(/\byou are\b/gi, (match) => preserveCase(match, "they are"))
    .replace(/\byou have\b/gi, (match) => preserveCase(match, "they have"))
    .replace(/\byou can\b/gi, (match) => preserveCase(match, "they can"))
    .replace(/\byou could\b/gi, (match) => preserveCase(match, "they could"))
    .replace(/\byou will\b/gi, (match) => preserveCase(match, "they will"))
    .replace(/\byou would\b/gi, (match) => preserveCase(match, "they would"))
    .replace(/\b(have|do|does|are|were|can|could|did|will|would|should)\s+you\b/gi, (match, aux: string) => {
      const replacement = `${aux.toLowerCase()} they`;
      return preserveCase(match, replacement);
    })
    .replace(/\byour\b/gi, (match) => preserveCase(match, "their"))
    // Subject-position "you" should be handled above. Remaining instances are
    // object-position, e.g. "explained to you" or "apply to you".
    .replace(/\byou\b/gi, (match) => preserveCase(match, "them"));
}

const hasValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return true;
};

const setIfPresent = (target: Record<string, any>, key: string, value: unknown) => {
  if (!hasValue(value)) return;
  target[key] = value;
};

// Keys that represent critical profile fields that should be in main flow if not prefilled
const CRITICAL_PROFILE_KEYS = ["age_years", "sex_at_birth", "diagnosis_confirmed"];

const NON_TRIGGERING_CHOICE_VALUES = [
  "No",
  "None of the above",
  "Not applicable",
  "Not sure",
  "Unsure",
  "I don't know",
];

function buildNumericRule(logic?: PmqLogicEntry): Record<string, unknown> | undefined {
  const params = logic?.params;
  if (!params || typeof params !== "object") return undefined;

  const operator = typeof params.operator === "string" ? params.operator.trim() : "";
  const value = params.threshold ?? params.value;
  if (operator && value !== undefined && value !== null) {
    return { operator, value };
  }

  const min = params.min ?? params.min_age;
  const max = params.max ?? params.max_age;
  if (min !== undefined || max !== undefined) {
    return { operator: "between", min, max };
  }

  return undefined;
}

function buildChoiceRule(
  kind: UiQuestion["kind"],
  disqualifyWhen: string | null,
  qualifiesWhen: string | null,
  options: string[],
): Record<string, unknown> | undefined {
  if (disqualifyWhen) {
    const normalized = disqualifyWhen.trim().toLowerCase();
    if (kind === "choice" && normalized === "yes" && !options.some((option) => option.toLowerCase() === "yes")) {
      return { operator: "any_except", value: NON_TRIGGERING_CHOICE_VALUES };
    }
    return { operator: "equals", value: disqualifyWhen };
  }

  if (qualifiesWhen) {
    return { operator: "equals", value: qualifiesWhen };
  }

  return undefined;
}

function convertPmqQuestion(
  question: PmqQuestion,
  index: number,
  profile: UserProfile | undefined,
  initialAnswers: Record<string, any>,
): UiQuestion | null {
  const rawKey =
    typeof question.id === "string"
      ? question.id.trim()
      : typeof question.question_key === "string"
      ? question.question_key.trim()
      : typeof question.key === "string"
      ? question.key.trim()
      : `missing_id_${index}`;
  const key = rawKey.trim();
  const text = typeof question.text === "string" ? question.text.trim() : "";
  if (!key || !text) return null;

  // Check if already answered via profile - using key aliases for common fields
  const keyLowerCheck = key.toLowerCase();
  
  // Map of question key patterns to profile field names
  const getProfileValue = (): unknown => {
    if (!profile) return undefined;
    
    // Direct key match
    const directValue = (profile as Record<string, unknown>)[key];
    if (hasValue(directValue)) return directValue;
    
    // Age aliases
    if (keyLowerCheck.includes('age')) {
      if (hasValue(profile.age_years)) return profile.age_years;
    }
    
    // Sex/gender aliases
    if (keyLowerCheck.includes('sex') || keyLowerCheck.includes('gender')) {
      if (hasValue(profile.sex_at_birth)) return profile.sex_at_birth;
    }
    
    // Diagnosis aliases
    if (keyLowerCheck.includes('diagnos') || keyLowerCheck.includes('condition')) {
      if (hasValue(profile.diagnosis_confirmed)) return profile.diagnosis_confirmed;
    }
    
    return undefined;
  };
  
  const profileValue = getProfileValue();
  if (hasValue(profileValue)) {
    if (initialAnswers[key] === undefined) {
      initialAnswers[key] = profileValue;
    }
    return null; // Skip this question - already answered
  }

  const options = Array.isArray(question.options)
    ? question.options.filter(
        (option): option is string => typeof option === "string" && option.trim().length > 0,
      )
    : [];

  const keyLower = key.toLowerCase();
  const textLower = text.toLowerCase();
  const combinedLower = `${keyLower} ${textLower}`;
  let kind: UiQuestion["kind"] = "boolean";
  let unit: string | undefined;
  let multiSelect = false;

  const isHeight = combinedLower.includes("height");
  const isWeight = combinedLower.includes("weight");
  const isBmi = /\bbmi\b/.test(combinedLower);
  const isLabValue = /\b(hemoglobin|platelet|bilirubin|alt|ast|anc|wbc|neutrophil|creatinine|glucose|a1c|sodium|potassium|chloride|bicarbonate|calcium|protein|albumin)\b/.test(combinedLower);
  const isCount = textLower.includes("how many") || /\bcount\b/.test(textLower);
  
  if (question.answer_type === "number" || isHeight || isWeight || isBmi || isLabValue || isCount) {
    kind = "number";
    if (isHeight) {
      if (/\b(inches?|ft|feet)\b/.test(combinedLower)) {
        unit = "inches";
      } else {
        unit = "cm";
      }
    } else if (isWeight) {
      if (/\b(lbs?|pounds?)\b/.test(combinedLower)) {
        unit = "lbs";
      } else {
        unit = "kg";
      }
    } else if (keyLower === "age_years" || /\bage\b/.test(textLower)) {
      unit = "years";
    } else if (question.validation?.unit) {
      unit = question.validation.unit;
    }
  } else if (options.length > 0 || question.answer_type === "single_select" || question.answer_type === "multi_select") {
    // Check if options are Yes/No variants - treat as boolean
    const optionsLower = options.map(o => o.toLowerCase().trim());
    const isYesNo = optionsLower.every(o =>
      ["yes", "no", "not applicable", "not sure", "unsure", "maybe", "i don't know"].includes(o)
    );
    
    if (isYesNo && options.length <= 3) {
      // Keep as boolean for Yes/No/Not sure type questions
      kind = "boolean";
    } else {
      kind = "choice";
      // Check if multi-select based on PMQ contract first, then text hints.
      multiSelect = question.answer_type === "multi_select" ||
                    textLower.includes("all that apply") ||
                    textLower.includes("select all") ||
                    textLower.includes("check all");
    }
  }

  const patientOverride =
    textLower.startsWith("do you have") ||
    textLower.startsWith("have you had") ||
    textLower.startsWith("are you") ||
    textLower.includes("diagnosed with");
  const clinicOnly = question.clinic_only === true && !patientOverride;

  // Derive clause type from the criterion logic entry — the backend sets
  // section="exclusion" + disqualify_when="Yes" for exclusion criteria.
  const criterionLogic = (question.logic ?? []).find((l) => l.type === "criterion");
  const disqualifyWhen = typeof criterionLogic?.disqualify_when === "string"
    ? criterionLogic.disqualify_when.trim()
    : null;
  const qualifiesWhen = typeof criterionLogic?.qualifies_when === "string"
    ? criterionLogic.qualifies_when.trim()
    : null;
  const isExclusion =
    criterionLogic?.section === "exclusion" ||
    Boolean(disqualifyWhen);

  const clauseRule: Record<string, unknown> | undefined =
    kind === "number"
      ? buildNumericRule(criterionLogic)
      : buildChoiceRule(kind, disqualifyWhen, qualifiesWhen, options);

  const clause: CriteriaClause = {
    criterion_id: key,
    type: isExclusion ? "exclusion" : "inclusion",
    category: "pmq",
    source: clinicOnly ? "site" : "patient",
    question_text: text,
    ...(clauseRule ? { rule: clauseRule } : {}),
  };

  const uiQuestion: UiQuestion = {
    id: key,
    kind,
    label: text,
    clause,
    sourceTag: clinicOnly ? SourceTag.Clinic : SourceTag.Patient,
  };

  if (question.help_text && typeof question.help_text === "string") {
    uiQuestion.helperText = question.help_text;
  }
  if (kind === "choice" && options.length > 0) {
    uiQuestion.options = options;
    uiQuestion.multiSelect = multiSelect;
  }
  if (kind === "number" && unit) {
    uiQuestion.unit = unit;
  }

  return uiQuestion;
}

/**
 * Converts PMQ payload into structured questions for the adaptive screener.
 * 
 * @param pmq - The questionnaire_json from Supabase
 * @param profile - Optional user profile for pre-filling answers
 * @returns mainQuestions, optionalQuestions, and initialAnswers
 */
export function pmqToUiQuestions(
  pmq: any,
  profile?: UserProfile | null,
  perspective: "self" | "other" = "self",
): PmqAdapterResult {
  const initialAnswers: Record<string, any> = {};

  // Seed initial answers from profile
  if (profile) {
    setIfPresent(initialAnswers, "age_years", profile.age_years);
    setIfPresent(initialAnswers, "sex_at_birth", profile.sex_at_birth);
    setIfPresent(initialAnswers, "zip", profile.zip);
    setIfPresent(initialAnswers, "diagnosis_confirmed", profile.diagnosis_confirmed);
  }

  const sourceQuestions = Array.isArray(pmq?.questions) ? (pmq.questions as PmqQuestion[]) : [];
  const sourceOptional = Array.isArray(pmq?.optional_questions) ? (pmq.optional_questions as PmqQuestion[]) : [];

  const mainQuestions: UiQuestion[] = [];
  const optionalQuestions: UiQuestion[] = [];

  const profileOrUndefined = profile ?? undefined;

  // Process main questions
  sourceQuestions.forEach((question, index) => {
    const uiQuestion = convertPmqQuestion(question, index, profileOrUndefined, initialAnswers);
    if (uiQuestion) {
      mainQuestions.push(uiQuestion);
    }
  });

  // Process optional questions
  sourceOptional.forEach((question, index) => {
    const uiQuestion = convertPmqQuestion(question, index + sourceQuestions.length, profileOrUndefined, initialAnswers);
    if (uiQuestion) {
      // Promote critical profile fields to main if profile is missing them
      const key = uiQuestion.id.toLowerCase();
      const isCritical = CRITICAL_PROFILE_KEYS.some(critKey => key.includes(critKey.toLowerCase()));
      if (isCritical && !hasValue(initialAnswers[uiQuestion.id])) {
        mainQuestions.push(uiQuestion);
      } else {
        optionalQuestions.push(uiQuestion);
      }
    }
  });

  // Sort questions by priority: demographics first, then clinical
  const getQuestionPriority = (q: UiQuestion): number => {
    const id = q.id.toLowerCase();
    const label = q.label.toLowerCase();
    const combined = id + ' ' + label;
    
    // Demographics - highest priority (1-3)
    if (combined.includes('age')) return 1;
    if (combined.includes('sex') || combined.includes('gender')) return 2;
    if (combined.includes('caregiver') || combined.includes('professional role') || combined.includes('clinician') || combined.includes('prescriber')) return 3;
    if (combined.includes('diagnos') || combined.includes('condition')) return 3;
    
    // Pregnancy/reproductive - only for females (4)
    if (combined.includes('pregnan') || combined.includes('breastfeed')) return 4;
    
    // Medications and treatments (5)
    if (combined.includes('medication') || combined.includes('treatment') || combined.includes('therap')) return 5;
    
    // Other medical conditions (6)
    if (combined.includes('disease') || combined.includes('disorder')) return 6;
    
    // Everything else - default priority
    return 10;
  };
  
  mainQuestions.sort((a, b) => getQuestionPriority(a) - getQuestionPriority(b));

  if (perspective === "other") {
    for (const q of mainQuestions) {
      q.label = transformForCaregiver(q.label);
      if (q.helperText) q.helperText = transformForCaregiver(q.helperText);
    }
    for (const q of optionalQuestions) {
      q.label = transformForCaregiver(q.label);
      if (q.helperText) q.helperText = transformForCaregiver(q.helperText);
    }
  }

  return { mainQuestions, optionalQuestions, initialAnswers };
}

// Legacy export for backward compatibility
export function pmqToUiQuestionsLegacy(
  pmq: any,
  profile?: UserProfile | null,
  perspective: "self" | "other" = "self",
): { uiQuestions: UiQuestion[]; initialAnswers: Record<string, any> } {
  const result = pmqToUiQuestions(pmq, profile, perspective);
  return {
    uiQuestions: [...result.mainQuestions, ...result.optionalQuestions],
    initialAnswers: result.initialAnswers,
  };
}

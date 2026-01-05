import { SourceTag, type NormalizedQuestionnaire, type UiQuestion, type UiQuestionnaire } from "../screener/types";
import type { EvalResult, PatientProfile, TrialRowLite } from "@/shared/eval";
import { evaluateTrialForPatient } from "@/shared/eval";

export type AnswerMap = Record<string, unknown>;

export type EvaluationDetail = {
  id: string;
  label: string;
  clauseType: 'inclusion' | 'exclusion';
  sourceTag?: SourceTag;
  status: 'met' | 'unmet' | 'unknown';
  critical?: boolean;
  category?: string;
};

export type EvaluationResult = {
  result: "likely" | "possible" | "no";
  score: number;
  met_includes: string[];
  unmet_includes: string[];
  triggered_excludes: string[];
  unknown: string[];
  reasons: string[];
  details: EvaluationDetail[];
  met_details: EvaluationDetail[];
  unknown_details: EvaluationDetail[];
  unmet_details: EvaluationDetail[];
};

// Tunable scoring constants preserved from the original evaluator.
export const CORE_BASE_3 = 75;
export const CORE_BASE_2 = 55;
export const CORE_BASE_1 = 35;
export const CORE_BASE_0 = 20;
export const INC_MET_BONUS = 5;
export const INC_MET_BONUS_CAP = 20;
export const INC_UNMET_PENALTY = 5;
export const INC_UNMET_PENALTY_CAP = 15;
export const POSSIBLE_CAP_SCORE = 49;
export const LIKELY_THRESHOLD = 70;
export const POSSIBLE_THRESHOLD = 40;

type EvaluateOptions = {
  criteriaNorm?: unknown;
  trial?: Partial<TrialRowLite>;
  profile?: PatientProfile;
  normalized?: NormalizedQuestionnaire;
};

const INCLUDE_PREFIX = "include:";
const EXCLUDE_PREFIX = "exclude:";
const CLINIC_PREFIX = "clinic:";

function isUiQuestionnaire(input: unknown): input is UiQuestionnaire {
  if (!input || typeof input !== "object") return false;
  const maybe = input as Partial<UiQuestionnaire>;
  return Array.isArray(maybe.include) && Array.isArray(maybe.exclude);
}

function questionnaireToCriteria(questionnaire: UiQuestionnaire) {
  return {
    includes: questionnaire.include.map((question) => question.clause),
    excludes: questionnaire.exclude.map((question) => question.clause),
  };
}

function normalizeTrialRow(
  trial?: Partial<TrialRowLite>,
  fallback?: Partial<TrialRowLite>,
): TrialRowLite {
  const nct =
    (trial?.nct_id ?? fallback?.nct_id ?? "").toString().trim() || "unknown";
  const minAge =
    typeof trial?.min_age_years === "number"
      ? trial?.min_age_years
      : typeof fallback?.min_age_years === "number"
      ? fallback?.min_age_years
      : null;
  const maxAge =
    typeof trial?.max_age_years === "number"
      ? trial?.max_age_years
      : typeof fallback?.max_age_years === "number"
      ? fallback?.max_age_years
      : null;
  const gender = (trial?.gender ?? fallback?.gender ?? null) as string | null;

  return {
    nct_id: nct,
    min_age_years: minAge,
    max_age_years: maxAge,
    gender,
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function coerceStringArray(value: unknown): string[] {
  if (isStringArray(value)) return value;
  if (typeof value === "string") return [value];
  if (value == null) return [];
  return [];
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function mergeStringArrays(
  ...arrays: Array<string[] | null | undefined>
): string[] {
  const collected: string[] = [];
  for (const arr of arrays) {
    if (!arr) continue;
    for (const entry of arr) {
      if (typeof entry === "string" && entry.trim().length > 0) {
        collected.push(entry.trim());
      }
    }
  }
  return Array.from(new Set(collected));
}

function coerceBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : undefined;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["yes", "true", "y", "1"].includes(normalized)) return true;
    if (["no", "false", "n", "0"].includes(normalized)) return false;
  }
  return undefined;
}

function buildProfileFromAnswers(
  answers: AnswerMap,
  questionnaire?: UiQuestionnaire,
  normalized?: NormalizedQuestionnaire,
): PatientProfile {
  const base: PatientProfile = {
    age: coerceNumber(answers.age ?? answers.age_years ?? answers["patient_age"]),
    sex: typeof answers.sex === "string" ? answers.sex : typeof answers.gender === "string" ? answers.gender : null,
    pregnancy:
      coerceBoolean(
        answers.pregnancy ??
          answers.pregnant ??
          answers["is_pregnant"] ??
          answers["currently_pregnant"],
      ) ?? null,
    conditions: [],
    meds: [],
    comorbidities: [],
    zip: typeof answers.zip === "string" ? answers.zip : typeof answers.zip_code === "string" ? answers.zip_code : null,
    home_lat: coerceNumber(answers.home_lat) ?? null,
    home_lon: coerceNumber(answers.home_lon) ?? null,
  };

  const directConditions = coerceStringArray(
    answers.condition ??
      answers.conditions ??
      answers.diagnoses ??
      answers["condition_list"],
  );
  if (directConditions.length > 0) {
    base.conditions = directConditions;
  }

  const directMeds = coerceStringArray(answers.meds ?? answers.medications);
  if (directMeds.length > 0) {
    base.meds = directMeds;
  }

  const directComorbidities = coerceStringArray(
    answers.comorbidities ?? answers["co_morbidities"],
  );
  if (directComorbidities.length > 0) {
    base.comorbidities = directComorbidities;
  }

  const byId = new Map<string, UiQuestion>();
  if (questionnaire) {
    questionnaire.include.forEach((question) => byId.set(question.id, question));
    questionnaire.exclude.forEach((question) => byId.set(question.id, question));
  }
  if (normalized) {
    normalized.primary.forEach((question) => {
      if (question.sourceTag === SourceTag.Patient && question.kind !== "heading") {
        byId.set(question.id, question);
      }
    });
  }

  for (const [rawId, rawValue] of Object.entries(answers)) {
    const question = byId.get(rawId);
    if (!question) continue;
    const clause = question.clause;
    const rule = clause.rule as { variable?: string; field?: string } | undefined;
    const field = (rule?.variable ?? rule?.field ?? "").toLowerCase();

    if (field.includes("age")) {
      const numeric = coerceNumber(rawValue);
      if (numeric != null) {
        base.age = numeric;
      }
      continue;
    }

    if (field.includes("sex") || field.includes("gender")) {
      if (typeof rawValue === "string") {
        base.sex = rawValue;
      } else if (typeof rawValue === "boolean") {
        base.sex = rawValue ? "female" : "male";
      }
      continue;
    }

    if (field.includes("pregnan")) {
      const boolValue = coerceBoolean(rawValue);
      if (boolValue != null) {
        base.pregnancy = boolValue;
      }
      continue;
    }

    if (
      field.includes("diagnos") ||
      field.includes("condition") ||
      clause.category?.toString().toLowerCase().includes("condition")
    ) {
      const normalizedAnswer = (() => {
        if (Array.isArray(rawValue)) {
          return rawValue
            .map((entry) => (typeof entry === "string" ? entry : null))
            .filter((entry): entry is string => entry != null);
        }
        if (typeof rawValue === "string") return [rawValue];
        if (typeof rawValue === "boolean") {
          if (rawValue === true) {
            return clause.question_text ? [clause.question_text] : [clause.category ?? "condition"];
          }
          return [];
        }
        return [];
      })();

      if (normalizedAnswer.length > 0) {
        base.conditions = [...(base.conditions ?? []), ...normalizedAnswer];
      }
    }

    if (field.includes("med") || clause.category?.toString().toLowerCase().includes("therapy")) {
      const normalizedAnswer = (() => {
        if (Array.isArray(rawValue)) {
          return rawValue
            .map((entry) => (typeof entry === "string" ? entry : null))
            .filter((entry): entry is string => entry != null);
        }
        if (typeof rawValue === "string") return [rawValue];
        return [];
      })();
      if (normalizedAnswer.length > 0) {
        base.meds = [...(base.meds ?? []), ...normalizedAnswer];
      }
    }

    if (field.includes("comorbid") || clause.category?.toString().toLowerCase().includes("history")) {
      const normalizedAnswer = (() => {
        if (Array.isArray(rawValue)) {
          return rawValue
            .map((entry) => (typeof entry === "string" ? entry : null))
            .filter((entry): entry is string => entry != null);
        }
        if (typeof rawValue === "string") return [rawValue];
        return [];
      })();
      if (normalizedAnswer.length > 0) {
        base.comorbidities = [...(base.comorbidities ?? []), ...normalizedAnswer];
      }
    }
  }

  const demographicAge = coerceNumber(
    answers.dem_age ?? answers.age_years ?? answers.age ?? answers.patient_age,
  );
  if (demographicAge != null) {
    base.age = demographicAge;
  }

  const demSex = answers.dem_sex;
  if (Array.isArray(demSex) && demSex.length > 0) {
    base.sex = String(demSex[0]);
  } else if (typeof demSex === "string" && demSex.trim().length > 0) {
    base.sex = demSex;
  }

  const demPregnancy = coerceBoolean(answers.dem_pregnancy);
  if (demPregnancy != null) {
    base.pregnancy = demPregnancy;
  }

  if (base.conditions && base.conditions.length > 0) {
    const deduped = Array.from(
      new Set(base.conditions.map((entry) => entry.trim()).filter((entry) => entry.length > 0)),
    );
    base.conditions = deduped;
  }
  if (base.meds && base.meds.length > 0) {
    base.meds = Array.from(
      new Set(base.meds.map((entry) => entry.trim()).filter((entry) => entry.length > 0)),
    );
  }
  if (base.comorbidities && base.comorbidities.length > 0) {
    base.comorbidities = Array.from(
      new Set(
        base.comorbidities
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0),
      ),
    );
  }

  return base;
}

function stripPrefix(value: string): string {
  if (value.startsWith(INCLUDE_PREFIX)) return value.slice(INCLUDE_PREFIX.length);
  if (value.startsWith(EXCLUDE_PREFIX)) return value.slice(EXCLUDE_PREFIX.length);
  if (value.startsWith(CLINIC_PREFIX)) return value.slice(CLINIC_PREFIX.length);
  return value;
}

type QuestionKind = "number" | "boolean" | "choice";

function getQuestionKind(question: UiQuestion): QuestionKind | undefined {
  if (typeof question.kind === "string") {
    if (question.kind === "number" || question.kind === "boolean" || question.kind === "choice") {
      return question.kind;
    }
  }

  const rule = question.clause?.rule as { variable?: string; field?: string; value?: unknown } | undefined;
  const variable = (rule?.variable ?? rule?.field ?? "").toString().toLowerCase();

  if (Array.isArray(question.options) && question.options.length > 0) {
    return "choice";
  }
  if (variable.includes("age") || variable.includes("bmi")) {
    return "number";
  }

  const rawValue = rule?.value;
  if (Array.isArray(rawValue)) {
    if (rawValue.some((entry) => typeof entry === "number")) return "number";
    if (rawValue.some((entry) => typeof entry === "string")) return "choice";
  }
  if (typeof rawValue === "number") return "number";
  if (typeof rawValue === "string") return "choice";
  return undefined;
}

function normalizeChoiceValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed.toLowerCase() : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return null;
}

function evaluateNumericQuestion(question: UiQuestion, rawAnswer: unknown): boolean | null {
  const numericAnswer = coerceNumber(rawAnswer);
  if (numericAnswer == null) return null;

  const rule = question.clause?.rule as { operator?: string; value?: unknown; min?: unknown; max?: unknown } | undefined;
  const operator = (rule?.operator ?? "").toString().toLowerCase();
  const rawValue = rule?.value;

  let minValue = coerceNumber(rule?.min ?? question.minValue);
  let maxValue = coerceNumber(rule?.max ?? question.maxValue);
  let minInclusive = question.minInclusive ?? true;
  let maxInclusive = question.maxInclusive ?? true;

  if (operator === "between" && Array.isArray(rawValue)) {
    const numericVals = rawValue.map(coerceNumber).filter((entry): entry is number => entry != null);
    if (numericVals.length >= 2) {
      minValue = Math.min(...numericVals);
      maxValue = Math.max(...numericVals);
      minInclusive = true;
      maxInclusive = true;
    }
  } else if (operator === ">" || operator === "gt") {
    minValue = coerceNumber(rawValue);
    minInclusive = false;
  } else if (operator === ">=" || operator === "min") {
    minValue = coerceNumber(rawValue);
    minInclusive = true;
  } else if (operator === "<" || operator === "lt") {
    maxValue = coerceNumber(rawValue);
    maxInclusive = false;
  } else if (operator === "<=" || operator === "max") {
    maxValue = coerceNumber(rawValue);
    maxInclusive = true;
  } else if (operator === "=" || operator === "==" || operator === "equals") {
    const numeric = coerceNumber(rawValue);
    if (numeric != null) {
      minValue = numeric;
      maxValue = numeric;
      minInclusive = true;
      maxInclusive = true;
    }
  }

  if (minValue != null) {
    if (minInclusive ? numericAnswer < minValue : numericAnswer <= minValue) {
      return false;
    }
  }
  if (maxValue != null) {
    if (maxInclusive ? numericAnswer > maxValue : numericAnswer >= maxValue) {
      return false;
    }
  }

  return true;
}

function evaluateChoiceQuestion(question: UiQuestion, rawAnswer: unknown): boolean | null {
  const answersArray = Array.isArray(rawAnswer)
    ? rawAnswer
    : rawAnswer === undefined || rawAnswer === null || rawAnswer === ""
    ? []
    : [rawAnswer];

  const normalizedAnswers = answersArray
    .map(normalizeChoiceValue)
    .filter((entry): entry is string => Boolean(entry));

  if (normalizedAnswers.length === 0) {
    return null;
  }

  const rule = question.clause?.rule as { value?: unknown } | undefined;
  const rawRuleValue = rule?.value;
  const normalizedRuleValues = Array.isArray(rawRuleValue)
    ? rawRuleValue.map(normalizeChoiceValue).filter((entry): entry is string => Boolean(entry))
    : rawRuleValue != null
    ? [normalizeChoiceValue(rawRuleValue)].filter((entry): entry is string => Boolean(entry))
    : [];

  if (normalizedRuleValues.length === 0) {
    return true;
  }

  return normalizedAnswers.some((answer) => normalizedRuleValues.includes(answer));
}

function evaluateQuestion(question: UiQuestion, answers: AnswerMap): boolean | null {
  const response = answers[question.id];
  if (response === undefined) return null;

  const kind = getQuestionKind(question);
  if (kind === "number") {
    return evaluateNumericQuestion(question, response);
  }
  if (kind === "choice") {
    return evaluateChoiceQuestion(question, response);
  }
  if (kind === "boolean") {
    if (response === null) return null;
    if (typeof response === "boolean") return response;
    if (typeof response === "string") {
      const normalized = response.trim().toLowerCase();
      if (["yes", "true", "y", "1"].includes(normalized)) return true;
      if (["no", "false", "n", "0"].includes(normalized)) return false;
    }
    return null;
  }

  if (response === null || response === undefined || response === "") return null;
  return true;
}

function convertEvalResult(
  core: EvalResult,
  questions: UiQuestion[],
  answers: AnswerMap,
  normalized?: NormalizedQuestionnaire,
): EvaluationResult {
  const metIncludes = core.met
    .filter((entry) => entry.startsWith(INCLUDE_PREFIX))
    .map(stripPrefix);
  const unmetIncludes = core.unmet
    .filter((entry) => entry.startsWith(INCLUDE_PREFIX))
    .map(stripPrefix);
  const triggeredExcludes = core.unmet
    .filter((entry) => entry.startsWith(EXCLUDE_PREFIX))
    .map(stripPrefix);
  const unknown = core.unknown.map(stripPrefix);

  const metBonus = Math.min(metIncludes.length * INC_MET_BONUS, INC_MET_BONUS_CAP);
  const unmetPenalty = Math.min(unmetIncludes.length * INC_UNMET_PENALTY, INC_UNMET_PENALTY_CAP);

  // Use higher base when we have met criteria, unknowns alone shouldn't cap the score
  const effectiveBase = metIncludes.length > 0 ? CORE_BASE_3 : CORE_BASE_2;
  let score = Math.max(0, Math.min(100, effectiveBase + metBonus - unmetPenalty));
  if (triggeredExcludes.length > 0) {
    score = Math.min(score, POSSIBLE_CAP_SCORE);
  }

  let result: "likely" | "possible" | "no";
  if (triggeredExcludes.length > 0) {
    result = "no";
  } else if (unmetIncludes.length > 0 || !core.hard_ok) {
    // Unmet inclusions or failed hard checks -> possible
    result = "possible";
  } else if (unknown.length > 0) {
    // Unknowns exist but all answered questions pass - still likely if score is high
    result = score >= LIKELY_THRESHOLD ? "likely" : "possible";
  } else {
    result = score >= LIKELY_THRESHOLD ? "likely" : "possible";
  }

  const normalizedAnswers = normalizeAnswers(answers);
  const normalizedLookup = new Map<
    string,
    {
      sourceTag?: SourceTag;
      clauseType?: 'inclusion' | 'exclusion';
      label?: string;
      critical?: boolean;
      category?: string;
    }
  >();
  if (normalized) {
    normalized.primary.forEach((question) => {
      normalizedLookup.set(question.id, {
        sourceTag: question.sourceTag,
        clauseType: question.clause.type,
        label: question.label,
        critical: question.clause.critical ?? undefined,
        category: question.clause.category,
      });
    });
  }
  const details: EvaluationDetail[] = [];
  const seen = new Set<string>();

  for (const question of questions) {
    if (!question || seen.has(question.id)) continue;
    seen.add(question.id);

    const rawResult = evaluateQuestion(question, normalizedAnswers);
    let status: 'met' | 'unmet' | 'unknown';

    if (question.clause.type === 'inclusion') {
      status = rawResult === true ? 'met' : rawResult === false ? 'unmet' : 'unknown';
    } else {
      status = rawResult === true ? 'unmet' : rawResult === false ? 'met' : 'unknown';
    }

    const normalizedOverride = normalizedLookup.get(question.id);

    details.push({
      id: question.id,
      label: normalizedOverride?.label ?? question.label,
      clauseType: normalizedOverride?.clauseType ?? question.clause.type,
      sourceTag: normalizedOverride?.sourceTag ?? question.sourceTag,
      status,
      critical: normalizedOverride?.critical ?? question.clause.critical ?? false,
      category: normalizedOverride?.category ?? question.clause.category,
    });
  }

  if (normalized) {
    for (const question of normalized.primary) {
      if (!question || seen.has(question.id)) continue;
      seen.add(question.id);

      const rawResult = evaluateQuestion(question, normalizedAnswers);
      let status: 'met' | 'unmet' | 'unknown';

      if (question.clause.type === 'inclusion') {
        status = rawResult === true ? 'met' : rawResult === false ? 'unmet' : 'unknown';
      } else {
        status = rawResult === true ? 'unmet' : rawResult === false ? 'met' : 'unknown';
      }

      details.push({
        id: question.id,
        label: question.label,
        clauseType: question.clause.type,
        sourceTag: question.sourceTag,
        status,
        critical: question.clause.critical ?? false,
        category: question.clause.category,
      });
    }
  }

  if (normalized?.clinicItems) {
    for (const item of normalized.clinicItems) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      details.push({
        id: item.id,
        label: item.label,
        clauseType: item.clause.type,
        sourceTag: SourceTag.Clinic,
        status: 'unknown',
        critical: item.clause.critical ?? false,
        category: item.clause.category,
      });
    }
  }

  const metDetails = details.filter(
    (detail) => detail.status === 'met' && detail.clauseType === 'inclusion',
  );
  const unmetDetails = details.filter((detail) => detail.status === 'unmet');
  const unknownDetails = details.filter((detail) => detail.status === 'unknown');

  // Recalculate score using locally evaluated details (not legacy core.met)
  // This ensures questions answered via PMQ adapter are properly counted
  const localMetCount = metDetails.length;
  const localUnmetCount = unmetDetails.filter(d => d.clauseType === 'inclusion').length;
  const localTriggeredExcludes = unmetDetails.filter(d => d.clauseType === 'exclusion').length;
  
  // Recalculate score with local data
  const localMetBonus = Math.min(localMetCount * INC_MET_BONUS, INC_MET_BONUS_CAP);
  const localUnmetPenalty = Math.min(localUnmetCount * INC_UNMET_PENALTY, INC_UNMET_PENALTY_CAP);
  const localEffectiveBase = localMetCount > 0 ? CORE_BASE_3 : CORE_BASE_2;
  let finalScore = Math.max(0, Math.min(100, localEffectiveBase + localMetBonus - localUnmetPenalty));
  
  if (localTriggeredExcludes > 0) {
    finalScore = Math.min(finalScore, POSSIBLE_CAP_SCORE);
  }
  
  // Recalculate result with local data
  let finalResult: "likely" | "possible" | "no" = result;
  if (localTriggeredExcludes > 0) {
    finalResult = "no";
  } else if (localUnmetCount > 0) {
    finalResult = "possible";
  } else if (unknownDetails.length > 0) {
    // All answered questions pass, unknowns don't block likely if score is high
    finalResult = finalScore >= LIKELY_THRESHOLD ? "likely" : "possible";
  } else if (localMetCount > 0) {
    finalResult = finalScore >= LIKELY_THRESHOLD ? "likely" : "possible";
  }

  const unknownSet = new Set(unknown);
  for (const detail of unknownDetails) {
    if (!unknownSet.has(detail.id)) {
      unknownSet.add(detail.id);
    }
  }
  const unknownList = Array.from(unknownSet);

  return {
    result: finalResult,
    score: finalScore,
    met_includes: metIncludes,
    unmet_includes: unmetIncludes,
    triggered_excludes: triggeredExcludes,
    unknown: unknownList,
    reasons: core.reasons,
    details,
    met_details: metDetails,
    unknown_details: unknownDetails,
    unmet_details: unmetDetails,
  };
}

export function evaluateTrial(
  criteriaInput: UiQuestionnaire | unknown,
  answers: AnswerMap,
  options: EvaluateOptions = {},
): EvaluationResult {
  const normalizedAnswers = normalizeAnswers(answers);
  const questionnaire = isUiQuestionnaire(criteriaInput)
    ? criteriaInput
    : isUiQuestionnaire(options.criteriaNorm)
    ? (options.criteriaNorm as UiQuestionnaire)
    : null;

  const criteriaNorm =
    options.criteriaNorm ??
    (questionnaire ? questionnaireToCriteria(questionnaire) : criteriaInput);

  const trialRow = normalizeTrialRow(
    options.trial,
    typeof criteriaInput === "object"
      ? {
          min_age_years: (criteriaInput as Record<string, unknown>)["min_age_years"] as number | undefined,
          max_age_years: (criteriaInput as Record<string, unknown>)["max_age_years"] as number | undefined,
          gender: (criteriaInput as Record<string, unknown>)["gender"] as string | undefined,
        }
      : undefined,
  );

  const derivedProfile = buildProfileFromAnswers(
    normalizedAnswers,
    questionnaire ?? undefined,
    options.normalized,
  );
  const profile: PatientProfile = options.profile
    ? {
        age: options.profile.age ?? derivedProfile.age,
        sex: options.profile.sex ?? derivedProfile.sex,
        pregnancy: options.profile.pregnancy ?? derivedProfile.pregnancy ?? null,
        conditions: mergeStringArrays(
          derivedProfile.conditions ?? [],
          options.profile.conditions ?? [],
        ),
        meds: mergeStringArrays(
          derivedProfile.meds ?? [],
          options.profile.meds ?? [],
        ),
        comorbidities: mergeStringArrays(
          derivedProfile.comorbidities ?? [],
          options.profile.comorbidities ?? [],
        ),
        zip: options.profile.zip ?? derivedProfile.zip ?? null,
        home_lat: options.profile.home_lat ?? derivedProfile.home_lat ?? null,
        home_lon: options.profile.home_lon ?? derivedProfile.home_lon ?? null,
      }
    : derivedProfile;

  const clinicChecks =
    options.normalized?.clinicItems?.map((item) => ({
      id: item.id,
      label: item.label,
    })) ?? [];

  const core = evaluateTrialForPatient(criteriaNorm, trialRow, profile, {
    clinicChecks,
  });
  const questionList = questionnaire
    ? [...questionnaire.include, ...questionnaire.exclude]
    : [];
  return convertEvalResult(core, questionList, normalizedAnswers, options.normalized);
}

export function normalizeAnswers(rawAnswers: Record<string, any>): AnswerMap {
  const normalized: AnswerMap = {};

  for (const [key, value] of Object.entries(rawAnswers)) {
    if (typeof value === "string") {
      const lower = value.toLowerCase();
      if (lower === "yes" || lower === "true") {
        normalized[key] = true;
      } else if (lower === "no" || lower === "false") {
        normalized[key] = false;
      } else {
        normalized[key] = value;
      }
    } else {
      normalized[key] = value;
    }
  }

  return normalized;
}

function runEvaluatorSelfTests() {
  const report = (condition: boolean, message: string) => {
    if (!condition && typeof console !== "undefined") {
      console.warn(`[matching:evaluator] ${message}`);
    }
  };

  const rangeCriteria = {
    includes: [
      {
        criterion_id: "age_between",
        type: "inclusion",
        category: "demographics",
        source: "patient",
        rule: { variable: "age", operator: "between", value: [18, 49] },
      },
    ],
  };

  const trialRow: TrialRowLite = {
    nct_id: "RANGE",
    min_age_years: 18,
    max_age_years: 49,
    gender: "All",
  };

  report(
    evaluateTrialForPatient(rangeCriteria, trialRow, { age: 49 }).hard_ok,
    "Expected age 49 to satisfy inclusive 18–49 range",
  );
  report(
    !evaluateTrialForPatient(rangeCriteria, trialRow, { age: 50 }).hard_ok,
    "Expected age 50 to fail inclusive 18–49 range",
  );

  const maxOnlyCriteria = {
    includes: [
      {
        criterion_id: "age_max",
        type: "inclusion",
        category: "demographics",
        source: "patient",
        rule: { variable: "age", max: 10 },
      },
    ],
  };

  report(
    evaluateTrialForPatient(maxOnlyCriteria, { nct_id: "MAX" }, { age: 10 }).hard_ok,
    "Expected age 10 to satisfy ≤10 rule",
  );
  report(
    !evaluateTrialForPatient(maxOnlyCriteria, { nct_id: "MAX" }, { age: 11 }).hard_ok,
    "Expected age 11 to fail ≤10 rule",
  );

  const minOnlyCriteria = {
    includes: [
      {
        criterion_id: "age_min",
        type: "inclusion",
        category: "demographics",
        source: "patient",
        rule: { variable: "age", min: 5 },
      },
    ],
  };

  report(
    evaluateTrialForPatient(minOnlyCriteria, { nct_id: "MIN" }, { age: 5 }).hard_ok,
    "Expected age 5 to satisfy ≥5 rule",
  );
  report(
    !evaluateTrialForPatient(minOnlyCriteria, { nct_id: "MIN" }, { age: 4 }).hard_ok,
    "Expected age 4 to fail ≥5 rule",
  );
}

if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
  runEvaluatorSelfTests();
}

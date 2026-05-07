import { adaptCriteriaJson, type UiQuestion } from "../lib/criteria/adapter";
import { normalizeQuestionnaire } from "../lib/criteria/normalize";
import { getServerSupabase } from "../lib/supabaseServer";

type TrialRow = {
  nct_id: string;
  title?: string | null;
  sponsor?: string | null;
  condition_slugs?: string[] | null;
  original_conditions?: string[] | null;
  criteria_json: any;
  min_age_years?: number | null;
  max_age_years?: number | null;
  gender?: string | null;
};

const NUMERIC_FALLBACK_VARIABLES = new Set([
  "age_years",
  "height_cm",
  "height_in",
  "weight_kg",
  "weight_lb",
  "bmi",
]);

function toLower(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function getQuestionKind(question: UiQuestion): string | undefined {
  if (typeof question.kind === "string") {
    return question.kind;
  }

  const raw = question as Record<string, unknown>;
  const alternate =
    (typeof raw.type === "string" ? (raw.type as string) : undefined) ??
    (typeof raw.inputType === "string" ? (raw.inputType as string) : undefined);
  if (alternate) {
    return alternate;
  }

  const variable = toLower(question.clause.rule?.variable ?? question.clause.rule?.field);
  if (NUMERIC_FALLBACK_VARIABLES.has(variable)) {
    return "number";
  }

  return undefined;
}

function determineRenderBranch(question: UiQuestion): string {
  const kind = getQuestionKind(question);
  if (kind === "boolean") {
    return "boolean-toggle";
  }
  if (kind === "number") {
    return "numeric-input";
  }
  if (kind === "choice") {
    const optionsCount = Array.isArray(question.options) ? question.options.length : 0;
    return optionsCount <= 4 ? "choice-grid" : "choice-select";
  }
  return "fallback-text";
}

function simplifyQuestion(question: UiQuestion) {
  const rule = question.clause?.rule;
  const normalizedRule =
    rule && (rule.variable || rule.field || rule.operator || rule.value !== undefined)
      ? {
          variable: rule.variable ?? rule.field ?? null,
          operator: rule.operator ?? null,
          value: rule.value ?? null,
        }
      : null;

  return {
    criterion_id: question.clause?.criterion_id ?? question.id,
    category: question.clause?.category ?? null,
    sourceTag: question.sourceTag ?? null,
    kind: question.kind ?? null,
    type: (question as Record<string, unknown>).type ?? null,
    inputType: (question as Record<string, unknown>).inputType ?? null,
    rule: normalizedRule,
    label: question.label,
    unit: question.unit ?? null,
    placeholder: question.placeholder ?? null,
    minValue: question.minValue ?? null,
    maxValue: question.maxValue ?? null,
  };
}

async function fetchTrial(nctId: string): Promise<TrialRow> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("trials")
    .select(
      "nct_id, title, sponsor, condition_slugs, original_conditions, criteria_json, min_age_years, max_age_years, gender",
    )
    .eq("nct_id", nctId)
    .single();

  if (error || !data) {
    throw new Error(`Trial ${nctId} not found: ${error?.message ?? "no data returned"}`);
  }

  return data as TrialRow;
}

async function run() {
  const nctArg = process.argv[2];
  const nctId = (nctArg || "NCT04396574").toUpperCase();

  console.log(`🩺 Screener trace for ${nctId}`);

  const trial = await fetchTrial(nctId);
  const rawCriteria = trial.criteria_json ?? {};
  const rawNorm = rawCriteria?.criteria_norm ?? {};
  const rawIncludeLength = Array.isArray(rawNorm?.include) ? rawNorm.include.length : 0;
  const rawExcludeLength = Array.isArray(rawNorm?.exclude) ? rawNorm.exclude.length : 0;

  console.log("criteria_norm lengths", {
    include: rawIncludeLength,
    exclude: rawExcludeLength,
  });

  const questionnaire = adaptCriteriaJson(rawCriteria);
  const normalized = normalizeQuestionnaire(questionnaire, {
    conditionSlug:
      Array.isArray(trial.condition_slugs) && trial.condition_slugs.length > 0
        ? trial.condition_slugs[0]
        : trial.original_conditions?.[0],
    trialMeta: {
      min_age_years: trial.min_age_years ?? undefined,
      max_age_years: trial.max_age_years ?? undefined,
      gender: trial.gender ?? undefined,
    },
    profile: null,
  });

  const patientCount = normalized.primary.length;
  const clinicOnlyCount = normalized.clinicOnlyCount;

  console.log("normalized counts", {
    patientCount,
    clinicOnlyCount,
    clinicItems: normalized.clinicItems.length,
  });

  const firstFive = normalized.primary.slice(0, 5).map(simplifyQuestion);
  const firstQuestion = normalized.primary[0];

  const traceOutput = {
    nct_id: trial.nct_id,
    patientCount,
    clinicOnlyCount,
    firstFiveQuestions: firstFive,
    firstQuestionAnalysis: firstQuestion
      ? {
          criterion_id: firstQuestion.clause?.criterion_id ?? firstQuestion.id,
          resolvedKind: getQuestionKind(firstQuestion) ?? null,
          renderBranch: determineRenderBranch(firstQuestion),
        }
      : null,
  };

  console.log(JSON.stringify(traceOutput, null, 2));
}

run().catch((error) => {
  console.error("Failed to run screener trace:", error);
  process.exitCode = 1;
});

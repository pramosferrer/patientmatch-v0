// Shared eligibility evaluator used by both the screener UI and match APIs.
// The implementation focuses on deterministic checks that can be derived from
// normalized criteria plus the basic trial row metadata.

type RawClause = Record<string, unknown>;

export type PatientProfile = {
  age?: number | null;
  sex?: string | null;
  pregnancy?: boolean | null;
  conditions?: string[] | null;
  meds?: string[] | null;
  comorbidities?: string[] | null;
  zip?: string | null;
  home_lat?: number | null;
  home_lon?: number | null;
};

export type EvalResult = {
  hard_ok: boolean;
  unmet: string[];
  met: string[];
  unknown: string[];
  reasons: string[];
};

export type TrialRowLite = {
  nct_id: string;
  min_age_years?: number | null;
  max_age_years?: number | null;
  gender?: string | null;
};

type NumberCandidate = {
  id: string;
  label: string;
  value: number;
  inclusive: boolean;
};

type ConditionInfo = {
  id: string;
  label: string;
  normalized: string;
};

type ClinicCheck = {
  id: string;
  label: string;
};

type EvalContext = {
  clinicChecks?: ClinicCheck[];
};

const STRING_FIELDS = [
  "question_text",
  "internal_description",
  "label",
  "title",
  "notes",
] as const;

const NUMERIC_KEYS = [
  "min_age_years",
  "max_age_years",
  "age_min",
  "age_max",
  "min_age",
  "max_age",
] as const;

const GENDER_KEYS = ["gender", "sex", "required_gender"];
const CONDITIONS_KEYS = ["conditions", "required_conditions", "includes"];
const EXCLUDES_KEYS = ["excludes", "excluded_conditions", "exclusions"];
const MED_KEYS = ["meds", "medications", "drugs", "drug_classes", "therapy", "treatments", "agents"];

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function coerceBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["yes", "true", "y", "1"].includes(normalized)) return true;
    if (["no", "false", "n", "0"].includes(normalized)) return false;
  }
  return null;
}

function toStringValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function normalizeGender(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["male", "m", "man", "men"].includes(normalized)) return "male";
  if (["female", "f", "woman", "women"].includes(normalized)) return "female";
  if (["nonbinary", "non-binary", "nb"].includes(normalized)) return "nonbinary";
  if (["all", "any", "both"].includes(normalized)) return "any";
  return normalized;
}

function normalizeConditionName(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeMedicationName(value: string): string {
  return value.trim().toLowerCase();
}

function getClauseId(clause: RawClause): string {
  const candidate =
    toStringValue(clause.criterion_id) ??
    toStringValue(clause.id) ??
    toStringValue((clause.rule as RawClause | undefined)?.field) ??
    toStringValue((clause.rule as RawClause | undefined)?.variable);
  return candidate ?? "criterion";
}

function getClauseLabel(clause: RawClause): string {
  for (const key of STRING_FIELDS) {
    const value = toStringValue(clause[key]);
    if (value) return value;
  }
  const rule = clause.rule as RawClause | undefined;
  const ruleValue = toStringValue(rule?.label) ?? toStringValue(rule?.value);
  if (ruleValue) return ruleValue;
  return getClauseId(clause);
}

function extractStrings(clause: RawClause, keys: readonly string[]): string[] {
  const collected: string[] = [];
  for (const key of keys) {
    const raw = clause[key];
    if (typeof raw === "string") {
      const candidate = raw.trim();
      if (candidate) collected.push(candidate);
    } else if (Array.isArray(raw)) {
      for (const entry of raw) {
        if (typeof entry === "string") {
          const candidate = entry.trim();
          if (candidate) collected.push(candidate);
        }
      }
    }
  }

  const rule = clause.rule;
  if (rule && typeof rule === "object") {
    const ruleObj = rule as RawClause;
    const value = ruleObj.value;
    if (typeof value === "string") {
      const candidate = value.trim();
      if (candidate) collected.push(candidate);
    } else if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string") {
          const candidate = entry.trim();
          if (candidate) collected.push(candidate);
        }
      }
    }
  }

  return collected;
}

function flattenCriteria(input: unknown): RawClause[] {
  const result: RawClause[] = [];
  const stack: unknown[] = [];

  if (Array.isArray(input)) {
    stack.push(...input);
  } else if (input && typeof input === "object") {
    stack.push(input);
  }

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }

    if (typeof current === "object") {
      const clause = current as RawClause;
      if (
        clause.type ||
        clause.criterion_id ||
        clause.question_text ||
        clause.rule ||
        clause.category
      ) {
        result.push(clause);
      }
      for (const value of Object.values(clause)) {
        if (value && (Array.isArray(value) || typeof value === "object")) {
          stack.push(value);
        }
      }
    }
  }

  return result;
}

function deriveMinMaxFromRule(
  clause: RawClause,
): { mins: NumberCandidate[]; maxes: NumberCandidate[] } {
  const mins: NumberCandidate[] = [];
  const maxes: NumberCandidate[] = [];
  const label = getClauseLabel(clause);
  const id = getClauseId(clause);

  const pushMin = (value: number | null, inclusive: boolean) => {
    if (value == null) return;
    mins.push({ id, label, value, inclusive });
  };

  const pushMax = (value: number | null, inclusive: boolean) => {
    if (value == null) return;
    maxes.push({ id, label, value, inclusive });
  };

  const rule = clause.rule as RawClause | undefined;
  const operator = toStringValue(rule?.operator)?.toLowerCase();

  if (rule) {
    const rawValue = rule.value;
    const valuesArray = Array.isArray(rawValue) ? rawValue : [rawValue];

    if (operator === "between") {
      const numericValues = valuesArray.map(toFiniteNumber).filter((v): v is number => v != null);
      if (numericValues.length >= 2) {
        const minVal = Math.min(...numericValues);
        const maxVal = Math.max(...numericValues);
        pushMin(minVal, true);
        pushMax(maxVal, true);
      }
    } else if (operator === ">" || operator === "gt") {
      pushMin(toFiniteNumber(rawValue), false);
    } else if (operator === ">=" || operator === "min") {
      pushMin(toFiniteNumber(rawValue), true);
    } else if (operator === "<" || operator === "lt") {
      pushMax(toFiniteNumber(rawValue), false);
    } else if (operator === "<=" || operator === "max") {
      pushMax(toFiniteNumber(rawValue), true);
    } else if (operator === "=" || operator === "==" || operator === "equals") {
      const numeric = toFiniteNumber(rawValue);
      pushMin(numeric, true);
      pushMax(numeric, true);
    }

    if (rule.hasOwnProperty("min")) {
      pushMin(toFiniteNumber(rule.min), true);
    }
    if (rule.hasOwnProperty("max")) {
      pushMax(toFiniteNumber(rule.max), true);
    }
  }

  for (const key of NUMERIC_KEYS) {
    const candidate = toFiniteNumber(clause[key]);
    if (candidate == null) continue;
    const keyLower = key.toLowerCase();
    if (keyLower.includes("max")) {
      pushMax(candidate, true);
    } else if (keyLower.includes("min")) {
      pushMin(candidate, true);
    }
  }

  return { mins, maxes };
}

function pickStrictMinimum(candidates: NumberCandidate[]): NumberCandidate | null {
  if (candidates.length === 0) return null;
  return candidates.reduce((prev, current) =>
    current.value < prev.value ? current : prev,
  );
}

function pickStrictMaximum(candidates: NumberCandidate[]): NumberCandidate | null {
  if (candidates.length === 0) return null;
  return candidates.reduce((prev, current) =>
    current.value > prev.value ? current : prev,
  );
}

function uniquePush(target: Set<string>, value: string) {
  if (!target.has(value)) target.add(value);
}

function dedupeStrings(values: Iterable<string>): string[] {
  return Array.from(new Set(values));
}

function normalizeProfile(profile: PatientProfile): Required<PatientProfile> {
  return {
    age: typeof profile.age === "number" && Number.isFinite(profile.age)
      ? profile.age
      : profile.age != null
      ? Number(profile.age)
      : null,
    sex: profile.sex ?? null,
    pregnancy: profile.pregnancy ?? null,
    conditions: profile.conditions ?? [],
    meds: profile.meds ?? [],
    comorbidities: profile.comorbidities ?? [],
    zip: profile.zip ?? null,
    home_lat:
      typeof profile.home_lat === "number" && Number.isFinite(profile.home_lat)
        ? profile.home_lat
        : null,
    home_lon:
      typeof profile.home_lon === "number" && Number.isFinite(profile.home_lon)
        ? profile.home_lon
        : null,
  };
}

export function evaluateTrialForPatient(
  criteriaNorm: unknown,
  trialRow: TrialRowLite,
  profileInput: PatientProfile,
  context: EvalContext = {},
): EvalResult {
  const normalizedProfile = normalizeProfile(profileInput);

  const met = new Set<string>();
  const unmet = new Set<string>();
  const unknown = new Set<string>();
  const reasons: string[] = [];

  const clauses = flattenCriteria(criteriaNorm);

  const minCandidates: NumberCandidate[] = [];
  const maxCandidates: NumberCandidate[] = [];

  const genderValues = new Set<string>();
  const genderLabels: string[] = [];

  const requiredConditions = new Map<string, ConditionInfo>();
  const excludedConditions = new Map<string, ConditionInfo>();
  const requiredMedications = new Map<string, ConditionInfo>();
  const excludedMedications = new Map<string, ConditionInfo>();
  const pregnancyClauses: Array<{ id: string; label: string }> = [];
  const clinicOnlyClauses: ClinicCheck[] = [];
  const clinicClauseSet = new Set<string>();

  for (const clause of clauses) {
    const typeValue = toStringValue(clause.type)?.toLowerCase();
    const category = toStringValue(clause.category)?.toLowerCase();
    const source = toStringValue(clause.source)?.toLowerCase();
    const label = getClauseLabel(clause);
    const id = getClauseId(clause);
    const rule = clause.rule as RawClause | undefined;
    const fieldName = toStringValue(rule?.variable) ?? toStringValue(rule?.field) ?? "";
    const normalizedField = fieldName.toLowerCase();

    if (source === "site" && (!rule || Object.keys(rule).length === 0)) {
      if (!clinicClauseSet.has(id)) {
        clinicClauseSet.add(id);
        clinicOnlyClauses.push({ id, label });
      }
      continue;
    }

    const numbersFromClause: number[] = [];
    for (const key of NUMERIC_KEYS) {
      const candidate = toFiniteNumber(clause[key]);
      if (candidate != null) numbersFromClause.push(candidate);
    }

    if (
      normalizedField.includes("age") ||
      category === "age" ||
      category === "demographics" ||
      (numbersFromClause.length > 0 && (typeValue === "inclusion" || typeValue === "include"))
    ) {
      const { mins, maxes } = deriveMinMaxFromRule(clause);
      minCandidates.push(...mins);
      maxCandidates.push(...maxes);

      for (const numeric of numbersFromClause) {
        if (numeric <= 150) {
          minCandidates.push({ id, label, value: numeric, inclusive: true });
        }
      }
    }

    const genderStrings = extractStrings(clause, GENDER_KEYS);
    if (genderStrings.length > 0) {
      for (const gender of genderStrings) {
        genderValues.add(gender.toLowerCase());
      }
      genderLabels.push(label);
    }

    const conditionStrings = extractStrings(clause, CONDITIONS_KEYS);
    if (conditionStrings.length > 0 && (typeValue === "inclusion" || typeValue === "include")) {
      for (const entry of conditionStrings) {
        const normalized = normalizeConditionName(entry);
        if (!requiredConditions.has(normalized)) {
          requiredConditions.set(normalized, { id, label, normalized });
        }
      }
    }

    const excludeStrings = extractStrings(clause, EXCLUDES_KEYS);
    if (excludeStrings.length > 0 && (typeValue === "exclusion" || typeValue === "exclude")) {
      for (const entry of excludeStrings) {
        const normalized = normalizeConditionName(entry);
        if (!excludedConditions.has(normalized)) {
          excludedConditions.set(normalized, { id, label, normalized });
        }
      }
    }

    const labelLower = label.toLowerCase();
    const medicationStrings = extractStrings(clause, MED_KEYS);
    const medicationSignal =
      medicationStrings.length > 0 ||
      normalizedField.includes("med") ||
      normalizedField.includes("drug") ||
      normalizedField.includes("therap") ||
      labelLower.includes("medication") ||
      labelLower.includes("drug") ||
      labelLower.includes("therapy") ||
      (category ?? "").includes("therapy");

    if (medicationSignal) {
      const normalizedMeds =
        medicationStrings.length > 0
          ? medicationStrings.map(normalizeMedicationName)
          : [normalizeMedicationName(label)];
      if (typeValue === "inclusion" || typeValue === "include") {
        for (const entry of normalizedMeds) {
          if (!requiredMedications.has(entry)) {
            requiredMedications.set(entry, { id, label, normalized: entry });
          }
        }
      } else if (typeValue === "exclusion" || typeValue === "exclude") {
        for (const entry of normalizedMeds) {
          if (!excludedMedications.has(entry)) {
            excludedMedications.set(entry, { id, label, normalized: entry });
          }
        }
      }
    }

    if ((typeValue === "exclusion" || normalizedField.includes("pregnan")) && labelLower.includes("pregnan")) {
      pregnancyClauses.push({ id, label });
    } else if (normalizedField.includes("pregnan")) {
      pregnancyClauses.push({ id, label });
    }
  }

  if (context.clinicChecks) {
    for (const check of context.clinicChecks) {
      if (!clinicClauseSet.has(check.id)) {
        clinicClauseSet.add(check.id);
        clinicOnlyClauses.push(check);
      }
    }
  }

  const trialMin = toFiniteNumber(trialRow.min_age_years);
  if (trialMin != null) {
    minCandidates.push({
      id: "trial_age_min",
      label: "Trial minimum age",
      value: trialMin,
      inclusive: true,
    });
  }
  const trialMax = toFiniteNumber(trialRow.max_age_years);
  if (trialMax != null) {
    maxCandidates.push({
      id: "trial_age_max",
      label: "Trial maximum age",
      value: trialMax,
      inclusive: true,
    });
  }
  const trialGender = normalizeGender(trialRow.gender);
  if (trialGender && trialGender !== "any") {
    genderValues.add(trialGender);
    genderLabels.push("Trial required gender");
  }

  let requiredAgeMin: NumberCandidate | null = null;
  let requiredAgeMax: NumberCandidate | null = null;
  let ageTooYoung = false;
  let ageTooOld = false;
  let ageMissing = false;

  if (minCandidates.length > 0) {
    const strictMin = pickStrictMaximum(minCandidates);
    if (strictMin) {
      requiredAgeMin = strictMin;
      const key = `include:age_min`;
      if (normalizedProfile.age != null && Number.isFinite(normalizedProfile.age)) {
        const satisfies = strictMin.inclusive
          ? normalizedProfile.age >= strictMin.value
          : normalizedProfile.age > strictMin.value;
        if (satisfies) {
          uniquePush(met, key);
        } else {
          uniquePush(unmet, key);
          ageTooYoung = true;
        }
      } else {
        uniquePush(unknown, key);
        ageMissing = true;
      }
    }
  }

  if (maxCandidates.length > 0) {
    const strictMax = pickStrictMinimum(maxCandidates);
    if (strictMax) {
      requiredAgeMax = strictMax;
      const key = `include:age_max`;
      if (normalizedProfile.age != null && Number.isFinite(normalizedProfile.age)) {
        const satisfies = strictMax.inclusive
          ? normalizedProfile.age <= strictMax.value
          : normalizedProfile.age < strictMax.value;
        if (satisfies) {
          uniquePush(met, key);
        } else {
          uniquePush(unmet, key);
          ageTooOld = true;
        }
      } else {
        uniquePush(unknown, key);
        ageMissing = true;
      }
    }
  }

  if (ageMissing) {
    reasons.push("Age not provided");
  } else if (ageTooYoung || ageTooOld) {
    if (requiredAgeMin && requiredAgeMax) {
      reasons.push(`Age not in ${requiredAgeMin.value}–${requiredAgeMax.value}`);
    } else if (ageTooYoung && requiredAgeMin) {
      reasons.push(`Age must be at least ${requiredAgeMin.value}`);
    } else if (ageTooOld && requiredAgeMax) {
      reasons.push(`Age must be ${requiredAgeMax.value} or younger`);
    }
  }

  const normalizedGenderRequirement = dedupeStrings(
    Array.from(genderValues, (value) => normalizeGender(value) ?? value),
  ).filter((value) => value && value !== "any");

  if (normalizedGenderRequirement.length > 0) {
    const key = "include:gender";
    const profileGender = normalizeGender(normalizedProfile.sex);
    if (profileGender) {
      if (normalizedGenderRequirement.includes(profileGender)) {
        uniquePush(met, key);
      } else {
        uniquePush(unmet, key);
        if (
          normalizedGenderRequirement.length === 1 &&
          normalizedGenderRequirement[0]
        ) {
          const requirement = normalizedGenderRequirement[0];
          if (requirement === "female") {
            reasons.push("Female-only study");
          } else if (requirement === "male") {
            reasons.push("Male-only study");
          } else {
            reasons.push("Gender requirement not met");
          }
        } else {
          reasons.push("Gender requirement not met");
        }
      }
    } else {
      uniquePush(unknown, key);
      reasons.push("Gender not provided");
    }
  }

  if (pregnancyClauses.length > 0) {
    const key = "exclude:pregnancy";
    const normalizedPregnancy = coerceBoolean(normalizedProfile.pregnancy);
    if (normalizedPregnancy === true) {
      uniquePush(unmet, key);
      reasons.push("Excludes currently pregnant participants");
    } else if (normalizedPregnancy === false) {
      uniquePush(met, key);
    } else {
      uniquePush(unknown, key);
      reasons.push("Pregnancy status not provided");
    }
  }

  const profileConditions = new Set(
    (normalizedProfile.conditions ?? []).map((value) => normalizeConditionName(String(value))),
  );
  const profileMeds = new Set(
    (normalizedProfile.meds ?? []).map((value) => normalizeMedicationName(String(value))),
  );

  if (requiredConditions.size > 0) {
    for (const info of requiredConditions.values()) {
      const key = `include:condition:${info.normalized}`;
      if (profileConditions.size === 0) {
        uniquePush(unknown, key);
        reasons.push(`Condition confirmation required: ${info.label}`);
      } else if (profileConditions.has(info.normalized)) {
        uniquePush(met, key);
      } else {
        uniquePush(unmet, key);
        reasons.push(`Requires condition: ${info.label}`);
      }
    }
  }

  if (excludedConditions.size > 0) {
    for (const info of excludedConditions.values()) {
      const key = `exclude:condition:${info.normalized}`;
      if (profileConditions.has(info.normalized)) {
        uniquePush(unmet, key);
        reasons.push(`Excludes condition: ${info.label}`);
      } else if (profileConditions.size === 0) {
        uniquePush(unknown, key);
      } else {
        uniquePush(met, key);
      }
    }
  }

  if (requiredMedications.size > 0) {
    for (const info of requiredMedications.values()) {
      const key = `include:med:${info.normalized}`;
      if (profileMeds.size === 0) {
        uniquePush(unknown, key);
        reasons.push(`Medication confirmation required: ${info.label}`);
      } else if (profileMeds.has(info.normalized)) {
        uniquePush(met, key);
      } else {
        uniquePush(unmet, key);
        reasons.push(`Requires medication: ${info.label}`);
      }
    }
  }

  if (excludedMedications.size > 0) {
    for (const info of excludedMedications.values()) {
      const key = `exclude:med:${info.normalized}`;
      if (profileMeds.has(info.normalized)) {
        uniquePush(unmet, key);
        reasons.push(info.label);
      } else if (profileMeds.size === 0) {
        uniquePush(unknown, key);
      } else {
        uniquePush(met, key);
      }
    }
  }

  for (const clause of clinicOnlyClauses) {
    const key = `clinic:${clause.id}`;
    uniquePush(unknown, key);
    reasons.push(`${clause.label} — confirmed by the study team at the clinic.`);
  }

  const hardOk = unmet.size === 0;

  return {
    hard_ok: hardOk,
    unmet: Array.from(unmet),
    met: Array.from(met),
    unknown: Array.from(unknown),
    reasons: dedupeStrings(reasons),
  };
}

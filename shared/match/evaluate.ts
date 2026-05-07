import type { PatientProfile } from './types';

export type EvalResult = {
  hard_ok: boolean;
  soft_hits: string[];
  unknown: string[];
  reasons: string[];
};

type CriteriaClause = Record<string, unknown>;

const STRING_PATHS = [
  'question_text',
  'internal_description',
  'label',
  'title',
  'notes',
];

const NUMERIC_KEYS = [
  'min_age_years',
  'max_age_years',
  'age_min',
  'age_max',
  'min_age',
  'max_age',
];

const GENDER_KEYS = ['gender', 'sex', 'required_gender'];
const CONDITIONS_KEYS = ['conditions', 'required_conditions', 'includes'];
const EXCLUDES_KEYS = ['excludes', 'excluded_conditions', 'exclusions'];

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function normalizeString(value: unknown): string | null {
  const str = toString(value);
  return str ? str.toLowerCase() : null;
}

function flattenCriteria(input: unknown): CriteriaClause[] {
  const result: CriteriaClause[] = [];
  const stack: unknown[] = [];

  if (Array.isArray(input)) {
    stack.push(...input);
  } else if (input && typeof input === 'object') {
    stack.push(input);
  }

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }

    if (typeof current === 'object') {
      const clause = current as CriteriaClause;
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
        if (value && (Array.isArray(value) || typeof value === 'object')) {
          stack.push(value);
        }
      }
    }
  }

  return result;
}

function extractNumbers(clause: CriteriaClause, keys: string[]): number[] {
  const collected: number[] = [];
  for (const key of keys) {
    const value = (clause as Record<string, unknown>)[key];
    const parsed = toNumber(value);
    if (parsed != null) collected.push(parsed);
  }
  const rule = clause.rule as Record<string, unknown> | undefined;
  if (rule && typeof rule === 'object') {
    const { value, min, max } = rule as {
      value?: unknown;
      min?: unknown;
      max?: unknown;
    };
    const parsedValue = toNumber(value);
    if (parsedValue != null) collected.push(parsedValue);
    const parsedMin = toNumber(min);
    if (parsedMin != null) collected.push(parsedMin);
    const parsedMax = toNumber(max);
    if (parsedMax != null) collected.push(parsedMax);
  }
  return collected;
}

function extractStrings(clause: CriteriaClause, keys: string[]): string[] {
  const collected: string[] = [];
  for (const key of keys) {
    const value = clause[key];
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized) collected.push(normalized);
    } else if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === 'string' && entry.trim().length > 0) {
          collected.push(entry.trim());
        }
      }
    }
  }

  const rule = clause.rule as Record<string, unknown> | undefined;
  if (rule && typeof rule === 'object') {
    const ruleValue = rule.value;
    if (typeof ruleValue === 'string' && ruleValue.trim()) {
      collected.push(ruleValue.trim());
    } else if (Array.isArray(ruleValue)) {
      for (const entry of ruleValue) {
        if (typeof entry === 'string' && entry.trim()) {
          collected.push(entry.trim());
        }
      }
    }
  }

  return collected;
}

function clauseContainsWord(clause: CriteriaClause, word: string): boolean {
  const needle = word.toLowerCase();
  for (const key of STRING_PATHS) {
    const value = clause[key];
    if (typeof value === 'string' && value.toLowerCase().includes(needle)) {
      return true;
    }
  }
  const rule = clause.rule;
  if (rule && typeof rule === 'object') {
    for (const value of Object.values(rule as Record<string, unknown>)) {
      if (typeof value === 'string' && value.toLowerCase().includes(needle)) {
        return true;
      }
    }
  }
  return false;
}

function pickMostRestrictive(numbers: number[], fallback: number | null, wantMax: boolean) {
  if (numbers.length === 0) return fallback;
  return wantMax ? Math.min(...numbers) : Math.max(...numbers);
}

function normalizeCondition(value: string): string {
  return value.trim().toLowerCase();
}

export function evaluateCriteria(
  criteriaNorm: unknown,
  profile: PatientProfile,
): EvalResult {
  const result: EvalResult = {
    hard_ok: true,
    soft_hits: [],
    unknown: [],
    reasons: [],
  };

  const clauses = flattenCriteria(criteriaNorm);

  const minAges: number[] = [];
  const maxAges: number[] = [];
  const requiredGenders = new Set<string>();
  const requiredConditions = new Set<string>();
  const excludedConditions = new Set<string>();
  let pregnancyExcluded = false;

  for (const clause of clauses) {
    const typeValue = normalizeString(clause.type);
    const category = normalizeString(clause.category);

    const numbers = extractNumbers(clause, NUMERIC_KEYS);
    if (typeValue === 'inclusion' || category === 'age') {
      if (numbers.length > 0) {
        const minCandidates = numbers.filter((num) => num <= 120);
        const maxCandidates = numbers.filter((num) => num <= 160);
        if (minCandidates.length > 0) {
          minAges.push(...minCandidates);
        }
        if (maxCandidates.length > 0) {
          maxAges.push(...maxCandidates);
        }
      }
    }

    const genders = extractStrings(clause, GENDER_KEYS).map((value) =>
      value.toLowerCase(),
    );
    if (genders.length > 0) {
      for (const gender of genders) {
        if (gender) requiredGenders.add(gender);
      }
    }

    const conditionStrings = extractStrings(clause, CONDITIONS_KEYS).map(
      normalizeCondition,
    );
    if (conditionStrings.length > 0) {
      for (const condition of conditionStrings) {
        requiredConditions.add(condition);
      }
    }

    const excludeStrings = extractStrings(clause, EXCLUDES_KEYS).map(
      normalizeCondition,
    );
    if (excludeStrings.length > 0) {
      for (const condition of excludeStrings) {
        excludedConditions.add(condition);
      }
    }

    if (
      (typeValue === 'exclusion' || category === 'safety') &&
      clauseContainsWord(clause, 'pregnan')
    ) {
      pregnancyExcluded = true;
    }
  }

  const profileAge = profile.age;
  if (typeof profileAge === 'number' && Number.isFinite(profileAge)) {
    const minAge = pickMostRestrictive(minAges, null, false);
    const maxAge = pickMostRestrictive(maxAges, null, true);

    if (minAge != null && profileAge < minAge) {
      result.hard_ok = false;
      result.reasons.push(`Requires age ≥ ${minAge}`);
    }
    if (maxAge != null && profileAge > maxAge) {
      result.hard_ok = false;
      result.reasons.push(`Requires age ≤ ${maxAge}`);
    }
    if (minAge == null && maxAge == null) {
      result.unknown.push('age');
    }
  } else {
    result.unknown.push('age');
  }

  const profileSex = normalizeString(profile.sex);
  if (profileSex) {
    if (requiredGenders.size > 0) {
      if (
        !requiredGenders.has('all') &&
        !requiredGenders.has('any') &&
        !requiredGenders.has(profileSex)
      ) {
        result.hard_ok = false;
        result.reasons.push('Does not match required gender');
      }
    }
  } else if (requiredGenders.size > 0) {
    result.unknown.push('gender');
  }

  if (profile.pregnancy === true && pregnancyExcluded) {
    result.hard_ok = false;
    result.reasons.push('Excludes currently pregnant participants');
  }

  const profileConditions = new Set(
    (profile.conditions ?? []).map((condition) => normalizeCondition(condition)),
  );

  if (requiredConditions.size > 0) {
    const missing = Array.from(requiredConditions).filter(
      (condition) => !profileConditions.has(condition),
    );
    if (missing.length > 0) {
      result.hard_ok = false;
      result.reasons.push(`Requires condition: ${missing[0]}`);
    }
  } else if ((profile.conditions ?? []).length === 0) {
    result.unknown.push('condition');
  }

  if (excludedConditions.size > 0) {
    const conflicts = Array.from(excludedConditions).filter((condition) =>
      profileConditions.has(condition),
    );
    if (conflicts.length > 0) {
      result.hard_ok = false;
      result.reasons.push(`Excludes condition: ${conflicts[0]}`);
    }
  }

  if ((profile.meds?.length ?? 0) > 0) {
    // Placeholder hook for medication mapping.
  }

  if ((profile.comorbidities?.length ?? 0) > 0) {
    // Placeholder hook for comorbidity mapping.
  }

  return {
    hard_ok: result.hard_ok,
    soft_hits: result.soft_hits,
    unknown: Array.from(new Set(result.unknown)),
    reasons: Array.from(new Set(result.reasons)),
  };
}

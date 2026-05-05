import type { PatientProfile, UrlMatchProfile } from '@/lib/schemas/patientProfile';
import { evaluateCriteria, type EvalResult } from '@/shared/match/evaluate';
import type { PatientProfile as MatchProfile } from '@/shared/match/types';

export type ScoreWithReasons = {
  value: number;
  reasons: string[];
};

export interface MatchingPatient {
  profile?: Partial<PatientProfile>;
  unknownMustHaveCriteria?: number | string[];
  softEligibilityFlags?: string[];
}

export interface MatchingTrial {
  status?: string | null;
  phase?: string | null;
  visit_model?: string | null;
  site_count?: number | null;
  fda_regulated?: boolean | null;
  unknownMustHaveCriteria?: number | string[];
  softEligibilityFlags?: string[];
  evaluation?: EvalResult;
}

export type ScoreDetail = {
  factor: string;
  impact: number;
  reason: string;
};

export type ScoreResult = {
  score0to100: number;
  label: 'Likely' | 'Possible' | 'Unlikely';
  reasons: string[];
  details: ScoreDetail[];
};

export type KeyInclusion = {
  criterion_id: string;
  field: string;
  kind: 'number' | 'boolean' | 'choice' | 'unknown';
  operator?: string;
  value?: unknown;
  priority: number;
  clause?: Record<string, unknown>;
};

const DISTANCE_BUCKETS: Array<{ upperBound: number; value: number; label: string }> = [
  { upperBound: 5, value: 1.0, label: 'Within 5 miles' },
  { upperBound: 10, value: 0.9, label: 'Within 10 miles' },
  { upperBound: 25, value: 0.75, label: 'Within 25 miles' },
  { upperBound: 50, value: 0.6, label: 'Within 50 miles' },
];

const DISTANCE_FAR_VALUE = 0.4;
const DISTANCE_UNKNOWN_VALUE = 0.5;

const REMOTE_MULTIPLIERS: Record<'remote' | 'hybrid' | 'on_site', number> = {
  remote: 1,
  hybrid: 0.9,
  on_site: 0.7,
};

const WEIGHT_ELIGIBILITY = 0.6;
const WEIGHT_LOGISTICS = 0.25;
const WEIGHT_PRIORITY = 0.15;

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function computeEligibilityScore(
  patient: MatchingPatient,
  trial: MatchingTrial,
): ScoreWithReasons {
  const evaluation = trial.evaluation ?? null;
  if (!evaluation) {
    return {
      value: 0.6,
      reasons: ['Eligibility criteria incomplete'],
    };
  }

  if (!evaluation.hard_ok) {
    const failureReasons: string[] = [];
    if (evaluation.reasons.length > 0) {
      failureReasons.push(...evaluation.reasons);
    } else {
      failureReasons.push('Does not meet required eligibility criteria');
    }
    return { value: 0, reasons: Array.from(new Set(failureReasons)) };
  }

  let value = 1;
  const collectedReasons: string[] = [];

  if (evaluation.reasons.length > 0) {
    collectedReasons.push(...evaluation.reasons);
  }

  if (evaluation.unknown.length > 0) {
    const penalty = Math.min(0.15 * evaluation.unknown.length, 0.45);
    value -= penalty;
    if (evaluation.unknown.length === 1) {
      collectedReasons.push(`Needs follow-up on ${evaluation.unknown[0]}`);
    } else {
      collectedReasons.push(`Needs follow-up on ${evaluation.unknown.length} criteria`);
    }
  }

  if (evaluation.soft_hits.length > 0) {
    value -= 0.1;
    collectedReasons.push(...evaluation.soft_hits);
  }

  return { value: clamp(value), reasons: Array.from(new Set(collectedReasons)) };
}

export function computeLogisticsScore(
  patient: MatchingPatient,
  trial: MatchingTrial,
  nearestMiles: number | null,
  _geocodeSource?: string | null,
): ScoreWithReasons {
  const reasons: string[] = [];

  let value = DISTANCE_UNKNOWN_VALUE;
  if (nearestMiles != null && Number.isFinite(nearestMiles)) {
    const distance = Number(nearestMiles);
    const bucket = DISTANCE_BUCKETS.find((entry) => distance <= entry.upperBound);
    if (bucket) {
      value = bucket.value;
      reasons.push(`${bucket.label} (~${Math.round(distance)} mi)`);
    } else {
      value = DISTANCE_FAR_VALUE;
      reasons.push(`More than ${DISTANCE_BUCKETS[DISTANCE_BUCKETS.length - 1].upperBound} miles (~${Math.round(distance)} mi)`);
    }
  } else {
    reasons.push('Distance unknown');
  }

  const prefersRemote = Boolean(patient.profile?.prefers_remote);
  const normalizedVisit = normalizeVisitModel(trial.visit_model);

  if (prefersRemote) {
    if (normalizedVisit === 'remote') {
      reasons.push('Matches remote participation preference');
      value *= REMOTE_MULTIPLIERS.remote;
    } else if (normalizedVisit === 'hybrid') {
      reasons.push('Hybrid visits available (remote preferred)');
      value *= REMOTE_MULTIPLIERS.hybrid;
    } else {
      reasons.push('In-person visits required (remote preferred)');
      value *= REMOTE_MULTIPLIERS.on_site;
    }
  }

  return { value: clamp(value), reasons: Array.from(new Set(reasons)) };
}

function isRecruiting(status?: string | null): boolean {
  if (!status) return false;
  return status.toLowerCase().includes('recruit');
}

function isPhaseTwoOrThree(phase?: string | null): boolean {
  if (!phase) return false;
  const normalized = phase.toLowerCase();
  return normalized.includes('phase ii') || normalized.includes('phase 2') ||
    normalized.includes('phase iii') || normalized.includes('phase 3');
}

export function computePriorityScore(trial: MatchingTrial): ScoreWithReasons {
  let value = 0.5;
  const reasons: string[] = [];

  const status = trial.status ? trial.status.toLowerCase() : '';
  if (status.includes('recruit')) {
    value = 1;
    reasons.push('Actively recruiting');
  } else if (status.includes('not yet')) {
    value = 0.7;
    reasons.push('Not yet recruiting');
  } else if (status.includes('invitation')) {
    value = 0.6;
    reasons.push('Enrolling by invitation');
  } else if (status) {
    reasons.push(`Status: ${trial.status}`);
    value = 0.5;
  }

  return { value: clamp(value), reasons: Array.from(new Set(reasons)) };
}

export function combineToConfidence(
  eligibility: ScoreWithReasons,
  logistics: ScoreWithReasons,
  priority: ScoreWithReasons,
): { score: number; confidence: number } {
  const weighted =
    eligibility.value * WEIGHT_ELIGIBILITY +
    logistics.value * WEIGHT_LOGISTICS +
    priority.value * WEIGHT_PRIORITY;

  const score = clamp(weighted);
  const confidence = Math.round(score * 100);
  return { score, confidence };
}

const EARTH_RADIUS_MILES = 3958.8;

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}

function getTrialCoordinates(trial: Record<string, unknown>): Array<{ lat: number; lon: number }> {
  const coords: Array<{ lat: number; lon: number }> = [];

  const nearestSite = trial && typeof trial === 'object' ? (trial as any).nearest_site : null;
  if (nearestSite && typeof nearestSite === 'object') {
    const lat = toNumber(nearestSite.lat);
    const lon = toNumber(nearestSite.lon);
    if (lat != null && lon != null) {
      coords.push({ lat, lon });
    }
  }

  const locations = Array.isArray((trial as any)?.locations) ? (trial as any).locations : [];
  for (const loc of locations) {
    if (!loc || typeof loc !== 'object') continue;
    const lat = toNumber((loc as any).lat ?? (loc as any).latitude);
    const lon = toNumber((loc as any).lon ?? (loc as any).lng ?? (loc as any).longitude);
    if (lat != null && lon != null) {
      coords.push({ lat, lon });
    }
  }

  return coords;
}

function computeNearestDistanceMiles(
  profile: UrlMatchProfile,
  trial: Record<string, unknown>,
): number | null {
  const directDistance = toNumber((trial as any)?.nearest_site?.distance_miles);
  if (directDistance != null) return directDistance;

  const lat = toNumber((profile as any)?.home_lat);
  const lon = toNumber((profile as any)?.home_lon);
  if (lat == null || lon == null) return null;

  const coordinates = getTrialCoordinates(trial);
  if (coordinates.length === 0) return null;

  let nearest: number | null = null;
  for (const coord of coordinates) {
    const distance = haversineDistance(lat, lon, coord.lat, coord.lon);
    if (nearest == null || distance < nearest) {
      nearest = distance;
    }
  }
  return nearest;
}

function normalizeVisitModel(value?: string | null): string | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes('remote')) return 'remote';
  if (lower.includes('hybrid')) return 'hybrid';
  if (lower.includes('on_site') || lower.includes('in-person') || lower.includes('in_person')) {
    return 'on_site';
  }
  return lower;
}

function addDetail(
  details: ScoreDetail[],
  reasonEntries: Array<{ reason: string; priority: number }>,
  factor: string,
  impact: number,
  reason: string,
  priority: number,
) {
  if (!impact) return;
  details.push({ factor, impact, reason });
  if (!reason) return;
  if (reasonEntries.some((entry) => entry.reason === reason)) return;
  reasonEntries.push({ reason, priority });
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function toLabel(score: number): 'Likely' | 'Possible' | 'Unlikely' {
  if (score >= 70) return 'Likely';
  if (score >= 40) return 'Possible';
  return 'Unlikely';
}

export function scoreTrial(
  profile: UrlMatchProfile,
  trial: Record<string, unknown>,
  _options?: { mode?: 'full' | 'preview' },
): ScoreResult {
  const details: ScoreDetail[] = [];
  const reasonEntries: Array<{ reason: string; priority: number }> = [];

  const normalizedProfile = toMatchProfileFromUrl(profile);
  const criteriaInput = buildCriteriaInput(trial);
  const evaluation = evaluateCriteria(criteriaInput, normalizedProfile);

  const matchingPatient: MatchingPatient = {
    profile: {
      prefers_remote: normalizedProfile.prefers_remote ?? undefined,
    },
  };

  const matchingTrial: MatchingTrial = {
    status: (trial as any)?.status,
    phase: (trial as any)?.phase,
    visit_model: (trial as any)?.visit_model,
    site_count: (trial as any)?.site_count,
    fda_regulated: (trial as any)?.fda_regulated ?? null,
    evaluation,
  };

  const distanceMiles = computeNearestDistanceMiles(profile, trial);

  const eligibilityScore = computeEligibilityScore(matchingPatient, matchingTrial);
  const logisticsScore = computeLogisticsScore(
    matchingPatient,
    matchingTrial,
    distanceMiles,
    (trial as any)?.nearest_site?.geocode_source ?? null,
  );
  const priorityScore = computePriorityScore(matchingTrial);

  let { confidence } = combineToConfidence(
    eligibilityScore,
    logisticsScore,
    priorityScore,
  );

  if (!evaluation.hard_ok) {
    confidence = Math.min(confidence, 20);
  } else if (evaluation.unknown.length >= 2) {
    confidence = Math.min(confidence, 65);
  }

  addDetail(
    details,
    reasonEntries,
    'Eligibility',
    Math.round((eligibilityScore.value - 0.5) * 100),
    eligibilityScore.reasons[0] ?? 'Eligibility looks strong',
    150,
  );
  addDetail(
    details,
    reasonEntries,
    'Logistics',
    Math.round((logisticsScore.value - 0.5) * 100),
    logisticsScore.reasons[0] ?? 'Logistics workable',
    120,
  );
  addDetail(
    details,
    reasonEntries,
    'Priority',
    Math.round((priorityScore.value - 0.5) * 100),
    priorityScore.reasons[0] ?? 'Priority acceptable',
    100,
  );

  const reasons = collectTopReasons(
    eligibilityScore.reasons,
    logisticsScore.reasons,
    priorityScore.reasons,
  );

  const score0to100 = clampScore(confidence);
  const label = toLabel(score0to100);

  return {
    score0to100,
    label,
    reasons,
    details,
  };
}

function collectTopReasons(
  eligibility: string[],
  logistics: string[],
  priority: string[],
): string[] {
  const reasons = [...eligibility, ...logistics, ...priority]
    .map((reason) => (typeof reason === 'string' ? reason.trim() : ''))
    .filter((reason) => reason.length > 0);
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const reason of reasons) {
    if (seen.has(reason)) continue;
    seen.add(reason);
    ordered.push(reason);
    if (ordered.length >= 3) break;
  }
  return ordered;
}

function toMatchProfileFromUrl(profile: UrlMatchProfile): MatchProfile {
  const rawConditions: string[] = Array.isArray((profile as any)?.conditions)
    ? ((profile as any).conditions as string[])
    : profile.condition
    ? [profile.condition]
    : [];

  const normalizedConditions = rawConditions
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0);

  const maxTravel =
    toNumber((profile as any)?.max_travel_miles) ??
    toNumber((profile as any)?.radiusMiles) ??
    null;

  const homeLat = toNumber((profile as any)?.home_lat);
  const homeLon = toNumber((profile as any)?.home_lon);

  return {
    age: profile.age,
    sex:
      profile.sex && profile.sex !== 'prefer_not_to_say'
        ? profile.sex
        : null,
    location: profile.zip ? { zip: profile.zip } : null,
    home_lat: homeLat,
    home_lon: homeLon,
    prefers_remote: (profile as any)?.remoteOk ?? true,
    max_travel_miles: maxTravel,
    willingness_to_travel_miles: maxTravel,
    conditions: normalizedConditions,
    pregnancy: null,
    comorbidities: Array.isArray((profile as any)?.comorbidities)
      ? ((profile as any).comorbidities as string[])
      : null,
    meds: Array.isArray((profile as any)?.meds)
      ? ((profile as any).meds as string[])
      : null,
  };
}

function buildCriteriaInput(trial: Record<string, unknown>): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  if ('criteria_json' in trial) {
    input.criteria = (trial as any).criteria_json;
  }
  if ('min_age_years' in trial) {
    input.min_age_years = (trial as any).min_age_years;
  }
  if ('max_age_years' in trial) {
    input.max_age_years = (trial as any).max_age_years;
  }
  if ('gender' in trial) {
    input.gender = (trial as any).gender;
  }
  if ((trial as any)?.required_conditions) {
    input.required_conditions = (trial as any).required_conditions;
  } else if ((trial as any)?.condition_slugs) {
    input.required_conditions = (trial as any).condition_slugs;
  }
  if ((trial as any)?.excluded_conditions) {
    input.excluded_conditions = (trial as any).excluded_conditions;
  }
  return input;
}

const FIELD_PRIORITY_MAP: Array<{ match: RegExp; score: number }> = [
  { match: /bmi/, score: 200 },
  { match: /ecog/, score: 180 },
  { match: /therapy|lines?/, score: 160 },
  { match: /diagnosis|disease/, score: 140 },
  { match: /age|sex|gender/, score: 120 },
];

function derivePriority(field: string, clause: Record<string, unknown>): number {
  const lower = field.toLowerCase();
  let priority = 50;
  for (const entry of FIELD_PRIORITY_MAP) {
    if (entry.match.test(lower)) {
      priority = Math.max(priority, entry.score);
      break;
    }
  }
  if (clause?.critical) {
    priority += 40;
  }
  return priority;
}

function detectKind(rule: Record<string, unknown>): {
  kind: KeyInclusion['kind'];
  operator?: string;
  value?: unknown;
} {
  const value = rule?.value;
  const operatorRaw = typeof rule?.operator === 'string' ? rule.operator : undefined;

  if (Array.isArray(value)) {
    return { kind: 'choice', operator: 'in', value };
  }

  if (typeof value === 'boolean') {
    return { kind: 'boolean', operator: operatorRaw, value };
  }

  const numericValue = toNumber(value);
  if (numericValue != null || ['>=', '>', '<=', '<', 'min', 'max', 'between', 'range'].includes(String(operatorRaw ?? '').toLowerCase())) {
    let op: string | undefined = undefined;
    if (operatorRaw) {
      const normalized = operatorRaw.toLowerCase();
      if (normalized === '>=' || normalized === 'min') op = 'min';
      else if (normalized === '<=' || normalized === 'max') op = 'max';
      else if (normalized === 'between' || normalized === 'range') op = 'range';
      else if (normalized === '>' || normalized === '<') op = normalized;
      else op = normalized;
    } else {
      op = undefined;
    }
    return { kind: 'number', operator: op, value: numericValue ?? value };
  }

  return { kind: 'unknown', operator: operatorRaw, value };
}

export function extractKeyInclusions(
  criteriaJson: unknown,
  maxItems = 5,
): KeyInclusion[] {
  if (!Array.isArray(criteriaJson) || maxItems <= 0) {
    return [];
  }

  const inclusions = criteriaJson
    .filter((clause) => clause && typeof clause === 'object' && (clause as any).type === 'inclusion')
    .map((clause, index) => {
      const record = clause as Record<string, unknown>;
      const rule = (record.rule && typeof record.rule === 'object'
        ? (record.rule as Record<string, unknown>)
        : {}) as Record<string, unknown>;
      const variable = typeof rule.variable === 'string' ? rule.variable : `criterion_${index}`;
      const field = variable;
      const priority = derivePriority(field, record);
      const { kind, operator, value } = detectKind(rule);
      return {
        criterion_id: String(record.criterion_id ?? variable),
        field,
        kind,
        operator,
        value,
        priority,
        clause: record,
      } as KeyInclusion;
    });

  inclusions.sort((a, b) => b.priority - a.priority);
  return inclusions.slice(0, maxItems);
}

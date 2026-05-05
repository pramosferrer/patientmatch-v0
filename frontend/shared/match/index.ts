import type { SupabaseClient } from '@supabase/supabase-js';

import { toConditionSlug, expandConditionSlug } from '@/shared/conditions-normalize';
import {
  combineToConfidence,
  computeEligibilityScore,
  computeLogisticsScore,
  computePriorityScore,
  type MatchingPatient,
  type MatchingTrial,
  scoreTrial as runScoreTrial,
  type ScoreResult,
} from '@/app/lib/matching/score';
import {
  buildCompactMatchTrial,
  type CompactMatchTrial,
} from '@/shared/match/transform';
import type { UrlMatchProfile } from '@/lib/schemas/patientProfile';
import { evaluateCriteria } from '@/shared/match/evaluate';
import type { PatientProfile } from '@/shared/match/types';
export type { PatientProfile } from '@/shared/match/types';

const recruitingStatuses = ['RECRUITING', 'ENROLLING BY INVITATION'];
const MAX_TRIAL_FETCH = 150;
const MAX_MATCH_RESULTS = 80;
const SOFT_DISTANCE_MULTIPLIER_REMOTE = 4;
const SOFT_DISTANCE_MULTIPLIER_ONSITE = 1.75;
const NEAREST_SITES_TTL_MS = 2 * 60 * 1000;

const remoteVisitModels = new Set(['remote', 'hybrid']);

type Nullable<T> = T | null | undefined;

type TrialRecord = {
  nct_id: string;
  title: string | null;
  phase: string | null;
  status: string | null;
  visit_model: string | null;
  site_count: number | null;
  sponsor: string | null;
  trial_url: string | null;
  last_update_date: string | null;
  fda_regulated: boolean | string | null;
  min_age_years: number | null;
  max_age_years: number | null;
  gender: string | null;
  condition_slugs: string[] | null;
  criteria_json?: unknown;
  locations?: unknown;
};

type NearestSiteRow = {
  trial_id: string | null;
  nct_id: string | null;
  nearest_miles: number | null;
  geocode_source?: string | null;
  site_city?: string | null;
  site_state?: string | null;
  site_lat?: number | null;
  site_lon?: number | null;
  nearest_site_city?: string | null;
  nearest_site_state?: string | null;
  nearest_site_lat?: number | null;
  nearest_site_lon?: number | null;
  city?: string | null;
  state?: string | null;
  lat?: number | null;
  lon?: number | null;
};

type NearestSitesMeta = {
  rows: NearestSiteRow[];
  distanceByNctId: Map<string, number>;
  detailByNctId: Map<
    string,
    {
      city: string | null;
      state: string | null;
      lat: number | null;
      lon: number | null;
      geocode_source: string | null;
    }
  >;
  idsWithinRadius: Set<string>;
};

const nearestSitesCache = new Map<string, { expiresAt: number; value: NearestSitesMeta }>();
const nearestSitesPending = new Map<string, Promise<NearestSitesMeta>>();

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const toStringOrNull = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
};

function normalizeRadius(value: Nullable<number>): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value <= 0) return null;
  return value;
}

function hasCoordinates(profile: PatientProfile): boolean {
  return (
    typeof profile.home_lat === 'number' &&
    Number.isFinite(profile.home_lat) &&
    typeof profile.home_lon === 'number' &&
    Number.isFinite(profile.home_lon)
  );
}

function toRad(x: number): number {
  return (x * Math.PI) / 180;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Radius of the Earth in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function normalizeFdaRegulated(value: TrialRecord['fda_regulated']): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['y', 'yes', 'true', '1'].includes(normalized)) return true;
    if (['n', 'no', 'false', '0'].includes(normalized)) return false;
  }
  return null;
}

type Axis = 'eligibility' | 'logistics' | 'priority';

type ReasonCandidate = {
  reason: string;
  axis: Axis;
  isDistance: boolean;
};

const FALLBACK_REASONS: Record<Axis, string> = {
  eligibility: 'Eligibility looks strong',
  logistics: 'Logistics work for you',
  priority: 'High-priority opportunity',
};

function normalizeReason(reason: string): string {
  return reason.trim();
}

function isDistanceReason(reason: string): boolean {
  const normalized = reason.toLowerCase();
  return normalized.includes('mile') || normalized.includes('distance');
}

function buildAxisReasonCandidates(axis: Axis, reasons: string[]): ReasonCandidate[] {
  const trimmed = reasons.map(normalizeReason).filter(Boolean);
  const candidates: ReasonCandidate[] = [];

  if (axis === 'logistics') {
    const distanceReasons = trimmed.filter(isDistanceReason);
    const nonDistanceReasons = trimmed.filter((reason) => !isDistanceReason(reason));
    if (distanceReasons[0]) {
      candidates.push({
        reason: distanceReasons[0],
        axis,
        isDistance: true,
      });
    }
    if (nonDistanceReasons[0]) {
      candidates.push({
        reason: nonDistanceReasons[0],
        axis,
        isDistance: false,
      });
    } else if (distanceReasons[1]) {
      candidates.push({
        reason: distanceReasons[1],
        axis,
        isDistance: true,
      });
    }
  } else {
    if (trimmed[0]) {
      candidates.push({
        reason: trimmed[0],
        axis,
        isDistance: isDistanceReason(trimmed[0]),
      });
    }
    if (trimmed[1]) {
      candidates.push({
        reason: trimmed[1],
        axis,
        isDistance: isDistanceReason(trimmed[1]),
      });
    }
  }

  if (candidates.length === 0) {
    const fallback = FALLBACK_REASONS[axis];
    candidates.push({
      reason: fallback,
      axis,
      isDistance: isDistanceReason(fallback),
    });
  }

  return candidates;
}

function collectReasons(
  eligibilityReasons: string[],
  logisticsReasons: string[],
  priorityReasons: string[],
): string[] {
  const axes: Array<[Axis, string[]]> = [
    ['logistics', logisticsReasons],
    ['eligibility', eligibilityReasons],
    ['priority', priorityReasons],
  ];

  const candidates = axes.flatMap(([axis, reasons]) =>
    buildAxisReasonCandidates(axis, reasons),
  );

  const selected: ReasonCandidate[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (selected.length >= 3) break;
    if (seen.has(candidate.reason)) continue;
    selected.push(candidate);
    seen.add(candidate.reason);
  }

  if (selected.length < 3) {
    for (const candidate of candidates) {
      if (selected.length >= 3) break;
      if (seen.has(candidate.reason)) continue;
      selected.push(candidate);
      seen.add(candidate.reason);
    }
  }

  if (selected.length > 0 && selected.every((item) => item.isDistance)) {
    const replacement = candidates.find(
      (candidate) =>
        !candidate.isDistance &&
        !selected.some((item) => item.reason === candidate.reason),
    );
    if (replacement) {
      const lastIdx = selected.length - 1;
      const last = selected[lastIdx];
      seen.delete(last.reason);
      selected[lastIdx] = replacement;
      seen.add(replacement.reason);
    }
  }

  return selected.slice(0, 3).map((item) => item.reason);
}

function buildCriteriaInputFromTrial(trial: TrialRecord): Record<string, unknown> {
  return {
    criteria: trial.criteria_json,
    min_age_years: trial.min_age_years ?? null,
    max_age_years: trial.max_age_years ?? null,
    gender: trial.gender ?? null,
    required_conditions: trial.condition_slugs ?? [],
  };
}

async function getNearestSites(
  supabase: SupabaseClient,
  lat: number,
  lon: number,
  radiusMiles: number | null,
): Promise<NearestSitesMeta> {
  const key = `${lat.toFixed(5)}:${lon.toFixed(5)}:${radiusMiles ?? 'none'}`;
  const now = Date.now();
  const cached = nearestSitesCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const pending = nearestSitesPending.get(key);
  if (pending) return pending;

  const fetchPromise = (async () => {
    const { data, error } = await supabase.rpc('nearest_sites_with_meta', {
      in_lat: lat,
      in_lon: lon,
      max_miles: radiusMiles ?? null,
    }) as { data: unknown; error: unknown };

    if (error) {
      throw error;
    }

    const rows = Array.isArray(data) ? (data as NearestSiteRow[]) : [];

    const distanceByNctId = new Map<string, number>();
    const detailByNctId = new Map<
      string,
      { city: string | null; state: string | null; lat: number | null; lon: number | null; geocode_source: string | null }
    >();
    const idsWithinRadius = new Set<string>();

    for (const row of rows) {
      if (!row?.nct_id) continue;
      const nctId = String(row.nct_id);
      const miles = toNumber(row.nearest_miles);
      if (miles != null) {
        distanceByNctId.set(nctId, miles);
      }
    }

    for (const row of rows) {
      if (!row?.nct_id) continue;
      const nctId = String(row.nct_id);
      const record = row as Record<string, unknown>;

      const city =
        toStringOrNull(record.site_city) ??
        toStringOrNull(record.nearest_site_city) ??
        toStringOrNull(record.city);
      const state =
        toStringOrNull(record.site_state) ??
        toStringOrNull(record.nearest_site_state) ??
        toStringOrNull(record.state);
      const latValue =
        toNumber(record.site_lat) ??
        toNumber(record.nearest_site_lat) ??
        toNumber(record.lat);
      const lonValue =
        toNumber(record.site_lon) ??
        toNumber(record.nearest_site_lon) ??
        toNumber(record.lon);
      const geocodeSource = toStringOrNull(record.geocode_source);

      if (city || state || latValue != null || lonValue != null || geocodeSource) {
        detailByNctId.set(nctId, {
          city: city ?? null,
          state: state ?? null,
          lat: latValue != null && Number.isFinite(latValue) ? latValue : null,
          lon: lonValue != null && Number.isFinite(lonValue) ? lonValue : null,
          geocode_source: geocodeSource ?? null,
        });
      }
    }

    for (const [nctId, miles] of distanceByNctId.entries()) {
      if (!Number.isFinite(miles)) continue;
      if (radiusMiles == null || miles <= radiusMiles + 1e-6) {
        idsWithinRadius.add(nctId);
      }
    }

    const meta: NearestSitesMeta = {
      rows,
      distanceByNctId,
      detailByNctId,
      idsWithinRadius,
    };

    nearestSitesCache.set(key, { value: meta, expiresAt: Date.now() + NEAREST_SITES_TTL_MS });
    return meta;
  })()
    .finally(() => {
      nearestSitesPending.delete(key);
    });

  nearestSitesPending.set(key, fetchPromise);
  return fetchPromise;
}

async function fetchCandidateTrials(
  supabase: SupabaseClient,
  conditionSlugs: string[],
  allowRemote: boolean,
  hasCoords: boolean,
  radiusMiles: number | null,
  radiusIds: string[],
  maxFetch: number,
): Promise<TrialRecord[]> {
  let query = supabase
    .from('trials_serving_latest')
    .select(
      'nct_id,title,phase,status,visit_model,site_count,sponsor,trial_url,last_update_date,fda_regulated,min_age_years,max_age_years,gender,condition_slugs,criteria_json,locations',
    )
    .eq('is_publishable', true)
    .in('status', recruitingStatuses)
    .order('last_update_date', { ascending: false })
    .limit(maxFetch);

  if (conditionSlugs.length === 1) {
    query = query.contains('condition_slugs', [conditionSlugs[0]]);
  } else if (conditionSlugs.length > 1) {
    const orClause = conditionSlugs
      .map((slug) => `condition_slugs.cs.{${slug}}`)
      .join(',');
    query = query.or(orClause);
  }


  if (hasCoords && radiusMiles != null) {
    if (allowRemote) {
      if (radiusIds.length > 0) {
        // Mixed: radius IDs OR remote/hybrid
        const formatted = radiusIds.map((id) => `"${id}"`).join(',');
        // Use a raw OR filter for complex mixed condition
        const orClause = `nct_id.in.(${formatted}),visit_model.eq.remote,visit_model.eq.hybrid`;
        query = query.or(orClause);
      } else {
        // No radius hits, but remote allowed -> fetch ONLY remote/hybrid
        // This avoids the "Bad Request" from malformed OR clause
        query = query.in('visit_model', ['remote', 'hybrid']);
      }
    } else if (radiusIds.length > 0) {
      query = query.in('nct_id', radiusIds);
    } else {
      // Has coords, radius constraint, no remote allowed, and no radius hits.
      // This results in 0 matches by definition.
      // We can either return empty immediately or let the query run (which will return empty).
      // Let's return empty to save DB call.
      return [];
    }
  } else if (!hasCoords) {
    query = query.in('visit_model', ['remote', 'hybrid']);
  }


  const { data, error } = await query;
  if (error) {
    console.error('fetchCandidateTrials Error:', JSON.stringify(error, null, 2));
    throw error;
  }

  return (data ?? []) as TrialRecord[];
}

function toUrlProfile(profile: PatientProfile, radiusMiles: number | null): UrlMatchProfile & {
  conditions?: string[];
  home_lat?: number | null;
  home_lon?: number | null;
} {
  const fallbackRadius = radiusMiles != null ? radiusMiles : 50;
  const radius = Math.max(5, Math.round(fallbackRadius));

  return {
    condition: profile.conditions[0] ?? 'other',
    conditions: profile.conditions,
    age: profile.age,
    sex: profile.sex as UrlMatchProfile['sex'],
    zip: profile.location?.zip ?? undefined,
    radiusMiles: radius,
    remoteOk: Boolean(profile.prefers_remote),
    home_lat: profile.home_lat ?? undefined,
    home_lon: profile.home_lon ?? undefined,
  };
}

export type MatchTrialsResult = {
  trials: Array<CompactMatchTrial & { details?: ScoreResult['details']; score0to100?: number; label?: ScoreResult['label'] }>;
  totals: { likely: number; possible: number; unlikely: number };
  averageConfidence: number;
  nearest: NearestSiteRow[];
  warnings: string[];
  candidateCount: number;
  includedCount: number;
};

export async function matchTrials(
  profile: PatientProfile,
  options: { supabase: SupabaseClient; maxTrials?: number },
): Promise<MatchTrialsResult> {
  const supabase = options.supabase;
  const maxFetch = options.maxTrials ?? MAX_TRIAL_FETCH;
  const warnings: string[] = [];
  let allowRemoteEffective = Boolean(profile.prefers_remote);

  const normalizedConditions = Array.from(
    new Set(
      (profile.conditions ?? [])
        .flatMap((condition) => expandConditionSlug(condition))
        .filter((slug): slug is string => Boolean(slug) && slug !== 'other'),
    ),
  );

  const radiusMiles =
    normalizeRadius(profile.max_travel_miles) ??
    normalizeRadius(profile.willingness_to_travel_miles);

  let searchRadiusUsed = radiusMiles;
  const hasCoords = hasCoordinates(profile);

  let nearestMeta: NearestSitesMeta | null = null;
  if (hasCoords && typeof profile.home_lat === 'number' && typeof profile.home_lon === 'number') {
    try {
      nearestMeta = await getNearestSites(
        supabase,
        profile.home_lat,
        profile.home_lon,
        searchRadiusUsed != null && searchRadiusUsed > 2000 ? null : searchRadiusUsed,
      );
    } catch (error) {
      warnings.push('nearest_sites_failed');
      nearestMeta = null;
    }
  }

  const radiusIds = nearestMeta ? Array.from(nearestMeta.idsWithinRadius) : [];
  const noRadiusHits =
    hasCoords && radiusMiles != null && nearestMeta && radiusIds.length === 0;
  if (noRadiusHits) {
    warnings.push('no_sites_within_radius');
  }
  // If radius is very large (> 2000 miles), treat it as effectively global for fetching purposes
  // to avoid missing trials due to RPC limitations or missing coordinates.
  // We will still filter by distance in memory if coordinates are available.
  const fetchRadiusMiles = (searchRadiusUsed != null && searchRadiusUsed > 2000) ? null : searchRadiusUsed;

  let trials = await fetchCandidateTrials(
    supabase,
    normalizedConditions,
    allowRemoteEffective,
    hasCoords,
    fetchRadiusMiles,
    radiusIds,
    maxFetch,
  );

  // Fallback #1: expand radius (up to a cap) while respecting on-site/remote preference
  if (trials.length === 0 && hasCoords && searchRadiusUsed != null) {
    const expandedRadius = Math.min(Math.max(searchRadiusUsed * 2, searchRadiusUsed + 50), 1000);
    const fallbackTrials = await fetchCandidateTrials(
      supabase,
      normalizedConditions,
      allowRemoteEffective,
      true, // hasCoords=true to avoid the "remote only" filter that triggers when hasCoords=false
      expandedRadius,
      radiusIds,
      maxFetch,
    );

    if (fallbackTrials.length > 0) {
      trials = fallbackTrials;
      searchRadiusUsed = expandedRadius;
      warnings.push('radius_expanded');
    }
  }

  // Fallback #2: if still nothing and user did not prefer remote, include remote/hybrid as a graceful fallback
  if (trials.length === 0 && !allowRemoteEffective) {
    const remoteTrials = await fetchCandidateTrials(
      supabase,
      normalizedConditions,
      true, // allow remote
      false, // treat as no coords to force remote/hybrid filter
      null, // no radius limit so we can at least show remote options
      [],   // radiusIds not used when hasCoords=false
      maxFetch,
    );
    if (remoteTrials.length > 0) {
      trials = remoteTrials;
      allowRemoteEffective = true;
      searchRadiusUsed = null;
      warnings.push('remote_fallback_applied');
    }
  }

  // Fallback #3: as a last resort, fetch global without radius if nothing else worked
  if (trials.length === 0 && hasCoords && searchRadiusUsed != null) {
    const globalTrials = await fetchCandidateTrials(
      supabase,
      normalizedConditions,
      allowRemoteEffective,
      true,
      null,
      [],
      maxFetch,
    );
    if (globalTrials.length > 0) {
      trials = globalTrials;
      searchRadiusUsed = null;
      warnings.push('radius_fallback_applied');
    }
  }

  const scored: Array<{ confidence: number; data: CompactMatchTrial & { details?: ScoreResult['details']; score0to100?: number; label?: ScoreResult['label'] } }> = [];
  const totals = { likely: 0, possible: 0, unlikely: 0 };
  let confidenceAccumulator = 0;
  let confidenceCount = 0;

  for (const trial of trials) {
    const nctId = trial.nct_id;
    const visitModel = trial.visit_model ?? null;
    const normalizedVisitModel = visitModel ? visitModel.toLowerCase() : null;
    const isRemoteVisit = normalizedVisitModel === 'remote';
    const isHybridVisit = normalizedVisitModel === 'hybrid';

    const distanceMiles =
      nearestMeta?.distanceByNctId.get(nctId) ?? null;
    const nearestDetail = nearestMeta?.detailByNctId.get(nctId);

    // If we have no distance from RPC (e.g. fallback trials), try to calculate it in-memory
    let calculatedDistance: number | null = distanceMiles;
    let calculatedNearest: { city: string | null; state: string | null; lat: number | null; lon: number | null; geocode_source?: string | null } | null = nearestDetail ? { ...nearestDetail } : null;

    if (calculatedDistance == null && hasCoords && typeof profile.home_lat === 'number' && typeof profile.home_lon === 'number' && trial.locations) {
      // Try to find the nearest location in the trial's locations list
      const locs = Array.isArray(trial.locations) ? trial.locations : [];
      let minDist = Infinity;
      let bestLoc: any = null;

      for (const loc of locs) {
        const lat = toNumber(loc.latitude ?? loc.lat ?? loc.coords?.lat);
        const lon = toNumber(loc.longitude ?? loc.lng ?? loc.lon ?? loc.coords?.lng ?? loc.coords?.lon);

        if (typeof lat === 'number' && typeof lon === 'number') {
          const dist = haversineDistance(profile.home_lat, profile.home_lon, lat, lon);
          if (dist < minDist) {
            minDist = dist;
            bestLoc = loc;
          }
        }
      }

      if (Number.isFinite(minDist)) {
        calculatedDistance = minDist;
        calculatedNearest = {
          city: bestLoc.city ?? null,
          state: bestLoc.state ?? null,
          lat: toNumber(bestLoc.latitude ?? bestLoc.lat ?? bestLoc.coords?.lat),
          lon: toNumber(bestLoc.longitude ?? bestLoc.lng ?? bestLoc.lon ?? bestLoc.coords?.lng ?? bestLoc.coords?.lon),
        };
      }
    }

    // Respect preference: include remote only if user prefers it or we explicitly fell back to remote.
    if (!allowRemoteEffective && isRemoteVisit) {
      continue;
    }

    const shouldApplyDistance =
      hasCoords &&
      searchRadiusUsed != null &&
      calculatedDistance != null &&
      !isRemoteVisit;

    const distanceThreshold = searchRadiusUsed != null
      ? searchRadiusUsed *
          (allowRemoteEffective && isHybridVisit
            ? SOFT_DISTANCE_MULTIPLIER_REMOTE
            : SOFT_DISTANCE_MULTIPLIER_ONSITE)
      : null;

    if (shouldApplyDistance && distanceThreshold != null && calculatedDistance != null && calculatedDistance > distanceThreshold) {
      continue;
    }

    const shouldForceUnknownDistance =
      !hasCoords && normalizedVisitModel != null && remoteVisitModels.has(normalizedVisitModel);

    const effectiveDistanceMiles = shouldForceUnknownDistance ? null : calculatedDistance;

    const evaluationProfile = {
      ...profile,
      conditions: normalizedConditions,
    };
    const evaluation = evaluateCriteria(buildCriteriaInputFromTrial(trial), evaluationProfile);

    const matchingPatient: MatchingPatient = {
      profile: {
        prefers_remote: Boolean(profile.prefers_remote),
      },
    };

    const matchingTrial: MatchingTrial = {
      status: trial.status,
      phase: trial.phase,
      visit_model: trial.visit_model,
      site_count: trial.site_count,
      fda_regulated: normalizeFdaRegulated(trial.fda_regulated),
      evaluation,
    };

    const eligibilityScore = computeEligibilityScore(
      matchingPatient,
      matchingTrial,
    );
    const logisticsScore = computeLogisticsScore(
      matchingPatient,
      matchingTrial,
      effectiveDistanceMiles,
      calculatedNearest?.geocode_source ?? nearestDetail?.geocode_source ?? null,
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

    if (Number.isFinite(confidence)) {
      confidenceAccumulator += confidence;
      confidenceCount += 1;
    }

    const bucket = !evaluation.hard_ok
      ? 'unlikely'
      : evaluation.unknown.length >= 2
      ? 'possible'
      : 'likely';
    totals[bucket] += 1;

    const reasons = collectReasons(
      eligibilityScore.reasons,
      logisticsScore.reasons,
      priorityScore.reasons,
    );

    const components = {
      eligibility: {
        value: eligibilityScore.value,
        reasons: eligibilityScore.reasons,
      },
      logistics: {
        value: logisticsScore.value,
        reasons: logisticsScore.reasons,
        distance_miles: effectiveDistanceMiles,
      },
      priority: {
        value: priorityScore.value,
        reasons: priorityScore.reasons,
      },
    };

    const nearest_site =
      effectiveDistanceMiles != null || nearestDetail
        ? {
            city: calculatedNearest?.city ?? nearestDetail?.city ?? null,
            state: calculatedNearest?.state ?? nearestDetail?.state ?? null,
            distance_miles: effectiveDistanceMiles,
            geocode_source: calculatedNearest ? 'calculated' : (nearestDetail?.geocode_source ?? null),
          }
        : null;

    const trialResult = buildCompactMatchTrial({
      nct_id: nctId,
      confidence,
      components,
      nearest_site,
      metadata: {
        title: trial.title ?? null,
        phase: trial.phase ?? null,
        status: trial.status ?? null,
        trial_url: trial.trial_url ?? null,
        sponsor: trial.sponsor ?? null,
        site_count: trial.site_count ?? null,
        visit_model: visitModel,
        min_age_years: trial.min_age_years ?? null,
        max_age_years: trial.max_age_years ?? null,
        gender: trial.gender ?? null,
        distance_miles: effectiveDistanceMiles ?? null,
        last_update_date: trial.last_update_date ?? null,
        reasons,
      },
    }) as CompactMatchTrial & {
      details?: ScoreResult['details'];
      score0to100?: number;
      label?: ScoreResult['label'];
    };

    if (shouldForceUnknownDistance) {
      (trialResult as Record<string, unknown>).distance_bucket = 'unknown';
      trialResult.components.logistics.distance_miles = null;
      if (trialResult.nearest_site) {
        trialResult.nearest_site = {
          ...trialResult.nearest_site,
          miles: null,
        };
      }
      trialResult.distance_miles = null;
    }

    if (
      trialResult.components.logistics.distance_miles == null &&
      !(trialResult as Record<string, unknown>).distance_bucket
    ) {
      (trialResult as Record<string, unknown>).distance_bucket = 'unknown';
    }

    const urlProfile = toUrlProfile(profile, radiusMiles);
    const scoreResult = runScoreTrial(urlProfile, {
      ...trial,
      nearest_site,
    });
    trialResult.details = scoreResult.details;
    trialResult.score0to100 = scoreResult.score0to100;
    trialResult.confidence = scoreResult.score0to100;
    trialResult.label = scoreResult.label;

    scored.push({
      confidence: Number.isFinite(confidence) ? confidence : -Infinity,
      data: trialResult,
    });
  }

  scored.sort((a, b) => (b.confidence ?? -Infinity) - (a.confidence ?? -Infinity));
  const trimmed = scored.slice(0, MAX_MATCH_RESULTS);
  const results = trimmed.map((entry) => entry.data);
  const averageConfidence =
    confidenceCount > 0 ? Math.round(confidenceAccumulator / confidenceCount) : 0;

  return {
    trials: results,
    totals,
    averageConfidence,
    nearest: nearestMeta?.rows ?? [],
    warnings: Array.from(new Set(warnings)),
    candidateCount: trials.length,
    includedCount: results.length,
  };
}

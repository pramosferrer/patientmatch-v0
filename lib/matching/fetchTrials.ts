import { getServerSupabase } from "@/lib/supabaseServer";
import { getServiceClient } from "@/lib/supabaseAdmin";
import {
  fetchNearestTrialsPage,
  fetchNearestTrialsPageByBoundingBox,
  applyNearestMetaToTrials,
} from "@/lib/trials/nearestSites";
import { resolveZipToLatLon } from "@/shared/geo";
import { calculateMatchConfidence } from "@/lib/matching/matchConfidence";
import { applyTrialsSort, buildConditionFilterData, parseStatusBuckets } from "@/lib/matching/trialList";
import type { PublicTrial } from "@/components/trials/PublicTrialCard";

const PAGE_SIZE = 24;
const DEFAULT_RADIUS = 50;
const TRIALS_PUBLIC_SELECT = "nct_id, title, display_title, status_bucket, conditions, quality_score, patient_readiness_score, sponsor, minimum_age, maximum_age, min_age_years, max_age_years, gender, phase, site_count_us, states_list, intervention_mode_primary, study_duration_days";
const TRIALS_BASE_BROWSE_SELECT = "nct_id, title, display_title, status_bucket, conditions, quality_score, sponsor, minimum_age, maximum_age, min_age_years, max_age_years, gender, phase, site_count_us, states_list";

// Map UI phase values ('1','2','3','4') to DB ilike patterns
export function buildPhaseOrFilter(phases: string[]): string {
  return phases.map((p) => `phase.ilike.%Phase ${p}%`).join(",");
}

// Commitment buckets → study_duration_days ranges (days)
export const COMMITMENT_BUCKETS: Record<string, [number, number]> = {
  short:    [0,   30],
  medium:   [31,  180],
  long:     [181, 365],
  extended: [366, 99999],
};

function toDbStatusBucket(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "recruiting") return "Recruiting";
  if (normalized === "active") return "Active";
  if (normalized === "not_yet_recruiting") return "Not yet recruiting";
  if (normalized === "enrolling_by_invitation") return "Enrolling by invitation";
  return value.trim();
}

function normalizeSexFilter(value: unknown): "male" | "female" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["male", "m", "man", "men"].includes(normalized)) return "male";
  if (["female", "f", "woman", "women"].includes(normalized)) return "female";
  return null;
}

function parseRadius(value: unknown): number {
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.min(Math.max(parsed, 5), 500);
    }
  }
  return DEFAULT_RADIUS;
}

async function fetchActiveReleaseTag(supabase: ReturnType<typeof getServerSupabase>): Promise<string | null> {
  const { data, error } = await supabase
    .from("pipeline_releases")
    .select("build_tag")
    .eq("status", "active")
    .order("activated_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return typeof data?.build_tag === "string" ? data.build_tag : null;
}

function applyStatusFilter<Query extends {
  eq: (column: string, value: unknown) => Query;
  in: (column: string, values: unknown[]) => Query;
}>(
  query: Query,
  statusBucketRaw: string,
  defaultRecruitingApplied: boolean,
): Query {
  if (defaultRecruitingApplied) {
    return query.eq("status_bucket", "Recruiting");
  }

  const statusBuckets = parseStatusBuckets(statusBucketRaw);
  if (statusBuckets.length === 1) {
    return query.eq("status_bucket", toDbStatusBucket(statusBuckets[0]));
  }
  if (statusBuckets.length > 1) {
    return query.in("status_bucket", statusBuckets.map(toDbStatusBucket));
  }
  return query;
}

function applyEligibilityFilters<Query extends {
  in: (column: string, values: unknown[]) => Query;
  or: (filters: string) => Query;
}>(
  query: Query,
  effectiveAge: unknown,
  effectiveSex: unknown,
  phases: string[],
): Query {
  if (typeof effectiveAge === "number" && Number.isFinite(effectiveAge)) {
    const age = Math.max(0, Math.round(effectiveAge));
    query = query.or(
      [
        `and(min_age_years.is.null,max_age_years.is.null)`,
        `and(min_age_years.is.null,max_age_years.gte.${age})`,
        `and(min_age_years.lte.${age},max_age_years.is.null)`,
        `and(min_age_years.lte.${age},max_age_years.gte.${age})`,
      ].join(","),
    );
  }

  const sexFilter = normalizeSexFilter(effectiveSex);
  if (sexFilter === "male") {
    query = query.in("gender", ["MALE", "male", "ALL", "all", "BOTH", "both", "ANY", "any"]);
  } else if (sexFilter === "female") {
    query = query.in("gender", ["FEMALE", "female", "ALL", "all", "BOTH", "both", "ANY", "any"]);
  }

  if (phases.length > 0) {
    query = query.or(buildPhaseOrFilter(phases));
  }

  return query;
}

type FetchTrialsOptions = {
  searchParams: Record<string, string | string[] | undefined>;
  profile: any;
};

function getDirectSiteFallbackClient(supabase: ReturnType<typeof getServerSupabase>) {
  try {
    return getServiceClient();
  } catch {
    return supabase;
  }
}

async function fetchRecruitingBrowsePage(
  supabase: ReturnType<typeof getServerSupabase>,
  activeReleaseTag: string | null,
  from: number,
  to: number,
): Promise<{ trialsData: PublicTrial[]; totalCount: number }> {
  let browseQuery = supabase
    .from("trials")
    .select(TRIALS_BASE_BROWSE_SELECT, { count: "estimated" })
    .eq("status_bucket", "Recruiting")
    .order("nct_id", { ascending: true })
    .range(from, to);

  if (activeReleaseTag) {
    browseQuery = browseQuery.eq("build_tag", activeReleaseTag);
  }

  const { data: supabaseData, count: supabaseCount, error } = await browseQuery;
  if (error) throw error;

  return {
    trialsData: (supabaseData ?? []).map((trial) => ({
      ...trial,
      patient_readiness_score: 0,
      intervention_mode_primary: null,
      study_duration_days: null,
    })) as PublicTrial[],
    totalCount: supabaseCount ?? supabaseData?.length ?? 0,
  };
}

export type FilterCounts = {
  recruiting?: number;
  phase2plus?: number;
};

export async function fetchFilterCounts({
  conditionFilterValues,
  nearbyIds,
  currentPhases,
  currentStatusBucket,
}: {
  conditionFilterValues: string[];
  nearbyIds: string[] | null;
  currentPhases: string[];
  currentStatusBucket: string;
}): Promise<FilterCounts> {
  const supabase = getServerSupabase();

  const base = () => {
    let q = supabase
      .from("trials_serving_latest")
      .select("nct_id", { count: "exact", head: true });
    if (conditionFilterValues.length > 0) q = q.overlaps("conditions", conditionFilterValues);
    if (nearbyIds) q = q.in("nct_id", nearbyIds);
    return q;
  };

  const results: FilterCounts = {};
  const work: Promise<void>[] = [];

  if (!currentStatusBucket || currentStatusBucket === "all") {
    work.push(
      Promise.resolve(
        base()
          .eq("status_bucket", "Recruiting")
          .then(({ count }) => { if (count !== null) results.recruiting = count; })
      ).catch(() => {}),
    );
  }

  if (currentPhases.length === 0) {
    work.push(
      Promise.resolve(
        base()
          .eq("status_bucket", "Recruiting")
          .or(buildPhaseOrFilter(["2", "3", "4"]))
          .then(({ count }) => { if (count !== null) results.phase2plus = count; })
      ).catch(() => {}),
    );
  }

  await Promise.all(work);
  return results;
}

export async function fetchTrials({ searchParams, profile }: FetchTrialsOptions) {
  const sp = searchParams;
  const q = (typeof sp.q === 'string' ? sp.q : "").trim();
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Determine effective filters
  // URL params always take priority
  // Cookie fallback ONLY when prefill=1 is explicitly set (e.g. from RestoreSearch or landing page redirect)
  const urlCondition = typeof sp.condition === 'string' ? sp.condition : "";
  const urlZip = typeof sp.zip === 'string' ? sp.zip : "";
  const urlSex = typeof sp.sex === 'string' ? sp.sex : "";
  const urlAge = typeof sp.age === 'string' ? sp.age : "";
  const urlRadius = sp.radius;
  const useCookieFallback = sp.prefill === '1';

  const effectiveCondition = urlCondition || (useCookieFallback ? (profile?.conditions?.[0] as string) : "") || "";
  const effectiveZip = urlZip || (useCookieFallback ? (profile?.zip as string) : "") || "";
  const effectiveSex = urlSex || (useCookieFallback ? profile?.sex : "") || "";
  const effectiveAge = urlAge ? parseInt(urlAge, 10) : (useCookieFallback ? profile?.age : null);
  const effectiveRadius = parseRadius(urlRadius);

  const {
    multiConditions,
    condition,
    conditionFilterValues,
  } = buildConditionFilterData(sp.conditions, effectiveCondition);

  const statusBucketRaw = typeof sp.status_bucket === "string" ? sp.status_bucket : typeof sp.status === "string" ? sp.status : "";
  const statusBucket = statusBucketRaw.trim().toLowerCase();

  // New advanced filters
  const urlPhases = typeof sp.phases === "string" ? sp.phases : "";
  const phases = urlPhases ? urlPhases.split(",").map((p) => p.trim()).filter(Boolean) : [];

  // When the user lands on /trials with no filters, default to Recruiting.
  // An unfiltered sort over 21k+ rows consistently times out; Recruiting is fast
  // and is the right default for patients who want to enroll in active studies.
  const defaultRecruitingApplied =
    !statusBucketRaw &&
    conditionFilterValues.length === 0 &&
    !q &&
    phases.length === 0;

  const broadBrowseSortApplied =
    conditionFilterValues.length === 0 &&
    !q &&
    phases.length === 0 &&
    !effectiveZip &&
    !urlAge &&
    !urlSex;

  // -- GEOSPATIAL LOGIC START --
  const supabase = getServerSupabase();
  const activeReleaseTagPromise = fetchActiveReleaseTag(supabase);
  let location = null;
  let proximityApplied = false;
  let proximityTitle = "";

  if (effectiveZip) {
    try {
      location = await resolveZipToLatLon(effectiveZip, supabase as any);
    } catch (e) {
      // failed to resolve zip
    }
  }

  let metaByNctId: Record<string, any> = {};
  let nearbyIds: string[] | null = null;
  let expansionApplied = false;
  let expansionNearestMiles: number | null = null;
  let proximityTotalCount: number | null = null;
  let locationSearchFailed = false;
  const statusValuesForProximity = defaultRecruitingApplied
    ? ["Recruiting"]
    : parseStatusBuckets(statusBucketRaw).map(toDbStatusBucket);
  const proximityFilters = {
    conditionValues: conditionFilterValues,
    statusValues: statusValuesForProximity,
    q,
    phases,
    age: typeof effectiveAge === "number" && Number.isFinite(effectiveAge) ? effectiveAge : null,
    sex: typeof effectiveSex === "string" ? effectiveSex : null,
  };

  if (location) {
    const activeReleaseTag = await activeReleaseTagPromise;
    const siteFallbackClient = getDirectSiteFallbackClient(supabase);
    const fallbackPage = await fetchNearestTrialsPageByBoundingBox(
      siteFallbackClient,
      location.lat,
      location.lon,
      effectiveRadius,
      PAGE_SIZE,
      from,
      {
        ...proximityFilters,
        buildTag: activeReleaseTag,
      },
    );

    if (!fallbackPage.error && fallbackPage.idsWithinRadius.length > 0) {
      metaByNctId = fallbackPage.metaByNctId;
      nearbyIds = fallbackPage.idsWithinRadius;
      proximityTotalCount = fallbackPage.totalCount;
      proximityApplied = true;
    } else {
      const canUseLegacyProximityRpc =
        !q &&
        phases.length === 0 &&
        !urlAge &&
        !urlSex;

      if (canUseLegacyProximityRpc) {
        const nearestPage = await fetchNearestTrialsPage(
          supabase,
          location.lat,
          location.lon,
          effectiveRadius,
          PAGE_SIZE,
          from,
          conditionFilterValues,
          statusValuesForProximity,
        );
        if (!nearestPage.error && nearestPage.idsWithinRadius.length > 0) {
          metaByNctId = nearestPage.metaByNctId;
          nearbyIds = nearestPage.idsWithinRadius;
          proximityTotalCount = nearestPage.totalCount;
          proximityApplied = true;
        } else if (nearestPage.error || fallbackPage.error) {
          locationSearchFailed = true;
        } else {
          const expanded = await fetchNearestTrialsPage(
            supabase,
            location.lat,
            location.lon,
            null,
            PAGE_SIZE,
            from,
            conditionFilterValues,
            statusValuesForProximity,
          );
          if (!expanded.error && expanded.idsWithinRadius.length > 0) {
            metaByNctId = expanded.metaByNctId;
            nearbyIds = expanded.idsWithinRadius;
            proximityTotalCount = expanded.totalCount;
            proximityApplied = true;
            expansionApplied = true;
            const distances = Object.values(expanded.metaByNctId)
              .map(m => m.nearest_miles)
              .filter((d): d is number => d !== null && d !== undefined);
            if (distances.length > 0) expansionNearestMiles = Math.round(Math.min(...distances));
          }
        }
      } else if (fallbackPage.error) {
        locationSearchFailed = true;
      }
    }
  }
  if (location && effectiveZip && !proximityApplied) {
    locationSearchFailed = true;
  }
  // -- GEOSPATIAL LOGIC END --

  // The view's exact count can timeout on broad pages, while its estimated count can be
  // wildly wrong. Keep estimated count only as a query-planning hint for broad sorted
  // reads, then compute the display total from the indexed base trials table below.
  const useEstimatedCountForPlan = !proximityApplied && conditionFilterValues.length === 0 && !Boolean(q);
  const selectOptions = proximityApplied
    ? undefined
    : { count: useEstimatedCountForPlan ? "estimated" as const : "exact" as const };

  let query = selectOptions
    ? supabase.from("trials_serving_latest").select(TRIALS_PUBLIC_SELECT, selectOptions)
    : supabase.from("trials_serving_latest").select(TRIALS_PUBLIC_SELECT);

  // Apply Filters
  if (conditionFilterValues.length > 0) {
    query = query.overlaps("conditions", conditionFilterValues);
  }
  if (q) query = query.ilike("title", `%${q}%`);

  if (proximityApplied && nearbyIds) {
    query = query.in("nct_id", nearbyIds);
  } else {
    query = applyStatusFilter(query, statusBucketRaw, defaultRecruitingApplied);
    query = applyEligibilityFilters(query, effectiveAge, effectiveSex, phases);
  }

  let trialsData: PublicTrial[] = [];
  let totalCount = 0;
  const exactTotalCountPromise = (async () => {
    if (proximityApplied && nearbyIds) return null;
    if (broadBrowseSortApplied) return null;

    const activeReleaseTag = await activeReleaseTagPromise;
    if (!activeReleaseTag) return null;

    let countQuery = supabase
      .from("trials")
      .select("nct_id", { count: "exact", head: true })
      .eq("build_tag", activeReleaseTag);

    if (conditionFilterValues.length > 0) {
      countQuery = countQuery.overlaps("conditions", conditionFilterValues);
    }
    if (q) countQuery = countQuery.ilike("title", `%${q}%`);

    countQuery = applyStatusFilter(countQuery, statusBucketRaw, defaultRecruitingApplied);
    countQuery = applyEligibilityFilters(countQuery, effectiveAge, effectiveSex, phases);

    const { count, error } = await countQuery;
    if (error) return null;
    return count;
  })();

  // For proximity mode we already know the page IDs — start the summaries query in
  // parallel with the main trials fetch so we don't pay two sequential roundtrips.
  const proximitySummaryPromise = (proximityApplied && nearbyIds && nearbyIds.length > 0)
    ? supabase.from("trial_insights_latest").select("nct_id, plain_summary_json").in("nct_id", nearbyIds)
    : null;

  if (proximityApplied && nearbyIds) {
    // PROXIMITY MODE: nearby eligibility path already filters, counts, and paginates IDs.
    const { data: supabaseData, error } = await query;
    if (error) throw error;

    const unsortedData = (supabaseData ?? []) as PublicTrial[];
    const idToIndex = new Map(nearbyIds.map((id, index) => [id, index]));

    const sortedData = unsortedData.sort((a, b) => {
       const idxA = idToIndex.get(a.nct_id) ?? Infinity;
       const idxB = idToIndex.get(b.nct_id) ?? Infinity;
       return idxA - idxB;
    });

    totalCount = proximityTotalCount ?? sortedData.length;
    trialsData = sortedData;
    proximityTitle = `trials near ${effectiveZip}`;
  } else if (broadBrowseSortApplied && defaultRecruitingApplied) {
    const activeReleaseTag = await activeReleaseTagPromise;
    const browsePage = await fetchRecruitingBrowsePage(supabase, activeReleaseTag, from, to);
    trialsData = browsePage.trialsData;
    totalCount = browsePage.totalCount;
  } else if (location && !proximityApplied && effectiveZip && locationSearchFailed) {
    const activeReleaseTag = await activeReleaseTagPromise;
    const browsePage = await fetchRecruitingBrowsePage(supabase, activeReleaseTag, from, to);
    trialsData = browsePage.trialsData;
    totalCount = browsePage.totalCount;
  } else {
    // STANDARD MODE
    // Broad browse pages should lead with patient-facing content readiness.
    // Filtered searches keep the normal quality sort so relevance is not swamped by metadata completeness.
    query = broadBrowseSortApplied
      ? query.order("nct_id", { ascending: true })
      : applyTrialsSort(query);
    query = query.range(from, to);

    const { data: supabaseData, count: supabaseCount, error } = await query;
    if (error) throw error;

    trialsData = (supabaseData ?? []) as PublicTrial[];
    const exactTotalCount = await exactTotalCountPromise;
    totalCount = exactTotalCount ?? supabaseCount ?? trialsData.length;
  }

  // Enrich with Geo Data
  if (Object.keys(metaByNctId).length > 0) {
    trialsData = await applyNearestMetaToTrials(trialsData, metaByNctId) as PublicTrial[];
  }

  // Batch-fetch AI summaries for card blurbs (proximity path already started this above)
  const nctIds = trialsData.map(t => t.nct_id);
  if (nctIds.length > 0) {
    const summaryResult = proximitySummaryPromise
      ? await proximitySummaryPromise
      : await supabase.from("trial_insights_latest").select("nct_id, plain_summary_json").in("nct_id", nctIds);

    const summaryMap = new Map<string, string>();
    for (const row of summaryResult.data ?? []) {
      try {
        const json = typeof row.plain_summary_json === "string"
          ? JSON.parse(row.plain_summary_json)
          : row.plain_summary_json;
        const fullSummary: string = json?.summary ?? "";
        const firstSentence = fullSummary.split(/(?<=\.)\s/)[0]?.trim() ?? "";
        if (firstSentence) summaryMap.set(row.nct_id, firstSentence);
      } catch { /* skip malformed */ }
    }

    trialsData = trialsData.map(t => ({
      ...t,
      card_summary: summaryMap.get(t.nct_id) ?? null,
    }));
  }

  // Calculate confidence for each trial
  // Merge effective params into profile for scoring to ensure dynamic updates (e.g. if user entered zip in header but no cookie yet)
  const scoringProfile = {
     ...profile,
     conditions: effectiveCondition ? [effectiveCondition] : profile?.conditions,
     zip: effectiveZip || profile?.zip,
     radius: effectiveRadius || profile?.radius
  };

  const enrichedTrials = trialsData.map(trial => ({
    ...trial,
    matchResult: calculateMatchConfidence(scoringProfile, trial)
  }));

  // Calculate overall profile confidence for the header
  const profileMatchResult = calculateMatchConfidence(scoringProfile);

  return {
    trialsData: enrichedTrials,
    totalCount,
    proximityApplied,
    proximityTitle,
    effectiveRadius,
    multiConditions,
    condition,
    statusBucket,
    conditionFilterValues,
    location,
    effectiveCondition,
    effectiveZip,
    page,
    q,
    phases,
    nearbyIds,
    profileMatchResult,
    expansionApplied,
    expansionNearestMiles,
    defaultRecruitingApplied,
    locationSearchFailed,
  };
}

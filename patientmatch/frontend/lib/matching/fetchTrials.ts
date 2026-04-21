import { getServerSupabase } from "@/lib/supabaseServer";
import { fetchNearestSitesMeta, applyNearestMetaToTrials } from "@/lib/trials/nearestSites";
import { resolveZipToLatLon } from "@/shared/geo";
import { calculateMatchConfidence } from "@/lib/matching/matchConfidence";
import { applyTrialsSort, buildConditionFilterData, parseStatusBuckets, sortTrialsByQualityScore, sortTrialsByDistance } from "@/lib/matching/trialList";
import type { PublicTrial } from "@/components/trials/PublicTrialCard";

const PAGE_SIZE = 24;
const DEFAULT_RADIUS = 50;
const TRIALS_PUBLIC_SELECT = "nct_id, title, display_title, status_bucket, conditions, quality_score, sponsor, minimum_age, maximum_age, min_age_years, max_age_years, gender, questionnaire_json, phase, site_count_us, states_list";

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

type FetchTrialsOptions = {
  searchParams: Record<string, string | string[] | undefined>;
  profile: any; // Type strictly if possible
};

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

  // -- GEOSPATIAL LOGIC START --
  const supabase = getServerSupabase();
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

  if (location) {
    const nearest = await fetchNearestSitesMeta(
      supabase,
      location.lat,
      location.lon,
      effectiveRadius
    );
    metaByNctId = nearest.metaByNctId;
    
    if (!nearest.error && nearest.idsWithinRadius.length > 0) {
      nearbyIds = nearest.idsWithinRadius;
      proximityApplied = true;
    }
  }
  // -- GEOSPATIAL LOGIC END --

  let query = supabase
    .from("trials_serving_latest")
    .select(TRIALS_PUBLIC_SELECT, { count: "exact" });

  // Apply Filters
  if (conditionFilterValues.length > 0) {
    query = query.overlaps("conditions", conditionFilterValues);
  }
  if (q) query = query.ilike("title", `%${q}%`);
  const statusBuckets = parseStatusBuckets(statusBucketRaw);
  if (statusBuckets.length === 1) {
    query = query.eq("status_bucket", statusBuckets[0]);
  } else if (statusBuckets.length > 1) {
    query = query.in("status_bucket", statusBuckets);
  }

  // Age-based filtering (min/max are numeric in years)
  if (typeof effectiveAge === "number" && Number.isFinite(effectiveAge)) {
    const age = Math.max(0, Math.round(effectiveAge));
    // (min_age_years is null OR min_age_years <= age) AND
    // (max_age_years is null OR max_age_years >= age)
    query = query.or(
      [
        `and(min_age_years.is.null,max_age_years.is.null)`,
        `and(min_age_years.is.null,max_age_years.gte.${age})`,
        `and(min_age_years.lte.${age},max_age_years.is.null)`,
        `and(min_age_years.lte.${age},max_age_years.gte.${age})`,
      ].join(","),
    );
  }

  // Gender-based filtering
  const sexFilter = normalizeSexFilter(effectiveSex);
  if (sexFilter === "male") {
    query = query.in("gender", ["MALE", "male", "ALL", "all", "BOTH", "both", "ANY", "any"]);
  } else if (sexFilter === "female") {
    query = query.in("gender", ["FEMALE", "female", "ALL", "all", "BOTH", "both", "ANY", "any"]);
  }

  if (proximityApplied && nearbyIds) {
    query = query.in("nct_id", nearbyIds);
  }

  let trialsData: PublicTrial[] = [];
  let totalCount = 0;

  if (proximityApplied && nearbyIds) {
    // PROXIMITY MODE: Fetch All -> Sort JS -> Paginate
    const { data: supabaseData, error } = await query;
    if (error) throw error;
    
    const unsortedData = (supabaseData ?? []) as PublicTrial[];
    const idToIndex = new Map(nearbyIds.map((id, index) => [id, index]));
    
    const sortedData = unsortedData.sort((a, b) => {
       const idxA = idToIndex.get(a.nct_id) ?? Infinity;
       const idxB = idToIndex.get(b.nct_id) ?? Infinity;
       return idxA - idxB;
    });
    
    totalCount = sortedData.length;
    trialsData = sortedData.slice(from, to);
    proximityTitle = `trials near ${effectiveZip}`;
  } else {
    // STANDARD MODE
    // Prioritize Recruiting status manually by putting quality and default sort first
    // Use the default sort from applyTrialsSort (Quality Score -> Title) overrides brute status sort
    query = applyTrialsSort(query);
    query = query.range(from, to);
    
    const { data: supabaseData, count: supabaseCount, error } = await query;
    if (error) throw error;
    
    trialsData = (supabaseData ?? []) as PublicTrial[];
    totalCount = supabaseCount ?? trialsData.length;
  }

  // Enrich with Geo Data
  if (Object.keys(metaByNctId).length > 0) {
    trialsData = await applyNearestMetaToTrials(trialsData, metaByNctId) as PublicTrial[];
  }

  // Batch-fetch AI summaries for card blurbs
  const nctIds = trialsData.map(t => t.nct_id);
  if (nctIds.length > 0) {
    const { data: summaryRows } = await supabase
      .from("trial_insights_latest")
      .select("nct_id, plain_summary_json")
      .in("nct_id", nctIds);

    const summaryMap = new Map<string, string>();
    for (const row of summaryRows ?? []) {
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
    profileMatchResult
  };
}

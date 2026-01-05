import { getServerSupabase } from "@/lib/supabaseServer";
import { fetchNearestSitesMeta, applyNearestMetaToTrials } from "@/lib/trials/nearestSites";
import { resolveZipToLatLon } from "@/shared/geo";
import { calculateMatchConfidence } from "@/lib/matching/matchConfidence";
import { applyTrialsSort, buildConditionFilterData, parseStatusBuckets, sortTrialsByQualityScore, sortTrialsByDistance } from "@/lib/matching/trialList";
import type { PublicTrial } from "@/components/trials/PublicTrialCard";

const PAGE_SIZE = 24;
const DEFAULT_RADIUS = 50;
const TRIALS_PUBLIC_SELECT = "nct_id, title, status_bucket, conditions, quality_score, sponsor, minimum_age, maximum_age, gender, questionnaire_json, phase";

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
  const effectiveAge = urlAge ? parseInt(urlAge) : (useCookieFallback ? profile?.age : null);
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
      location = await resolveZipToLatLon(effectiveZip, supabase);
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
    .from("trials")
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

  // Age-based filtering 
  // NOTE: minimum_age/maximum_age are currently TEXT strings like "18 Years"
  // Supabase .lte/.gte logic won't work correctly on these strings.
  // We skip server-side age filtering for now to avoid 0 results, 
  // but we still pass it to match scoring which handles it better client-side.

  // Gender-based filtering
  if (effectiveSex) {
    const userSex = String(effectiveSex).toUpperCase();
    if (userSex === 'MALE') {
       query = query.in('gender', ['MALE', 'ALL', 'BOTH']);
    } else if (userSex === 'FEMALE') {
       query = query.in('gender', ['FEMALE', 'ALL', 'BOTH']);
    }
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

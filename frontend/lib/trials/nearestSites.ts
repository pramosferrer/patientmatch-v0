"use server";

import type { SupabaseClient } from '@supabase/supabase-js';

export type NearestSiteMeta = {
  nct_id: string;
  nearest_miles: number | null;
  distance_miles: number | null; // Keep for back-compat if needed, or alias? Contract says `nearest_miles`.
  city: string | null;
  state_code: string | null;
  facility_name: string | null;
  lat: number | null;
  lon: number | null;
  geocode_source: string | null;
};

export type NearestSitesResult = {
  idsWithinRadius: string[];
  metaByNctId: Record<string, NearestSiteMeta>;
  error?: unknown;
};

export type NearestTrialsPageResult = NearestSitesResult & {
  totalCount: number;
};

const EARTH_RADIUS_MILES = 3958.7613;

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
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

function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(a)));
}

function boundingBox(
  lat: number,
  lon: number,
  radiusMiles: number,
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const latDelta = radiusMiles / 69;
  const lonDelta = radiusMiles / Math.max(1, 69 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLon: lon - lonDelta,
    maxLon: lon + lonDelta,
  };
}

export async function fetchNearestSitesMeta(
  supabase: SupabaseClient,
  lat: number,
  lon: number,
  radiusMiles: number | null,
  limitRows?: number,
): Promise<NearestSitesResult> {
  const metaByNctId: Record<string, NearestSiteMeta> = {};
  const idsWithinRadiusSet = new Set<string>();

  // RPC call using the Geom-powered function
  let rpc = supabase.rpc('nearest_sites_with_meta', {
    in_lat: lat,
    in_lon: lon,
    max_miles: radiusMiles ?? null,
  });
  if (limitRows) rpc = rpc.limit(limitRows);
  const { data, error } = await rpc;

  if (error) {
    console.warn('[trials] nearest_sites_with_meta RPC failed or missing', error);
    return { idsWithinRadius: [], metaByNctId: {}, error };
  }

  if (!Array.isArray(data)) {
    return { idsWithinRadius: [], metaByNctId: {} };
  }

  for (const rawRow of data) {
    const row = rawRow as Record<string, unknown>;
    const nctId = toStringOrNull(row?.nct_id);
    if (!nctId) continue;

    // Use server-side calculated distance (geom-based)
    const nearest_miles = toNumberOrNull(row?.nearest_miles);
    const distance_miles =
      nearest_miles != null && Number.isFinite(nearest_miles)
        ? Math.round(nearest_miles * 100) / 100
        : null;

    const city = toStringOrNull(row?.city);
    const state_code = toStringOrNull(row?.state_code) ?? toStringOrNull(row?.state);
    const facility_name = toStringOrNull(row?.facility_name);
    
    const latValue = toNumberOrNull(row?.lat);
    const lonValue = toNumberOrNull(row?.lon);
    const geocode_source = null;

    metaByNctId[nctId] = {
      nct_id: nctId,
      nearest_miles,
      distance_miles,
      city: city ?? null,
      state_code: state_code ?? null,
      facility_name: facility_name ?? null,
      lat: latValue,
      lon: lonValue,
      geocode_source,
    };

    // The RPC already filters by max_miles if passed!
    // But we might want to populate idsWithinRadiusSet explicitly from the return
    // to match the previous logic's output structure.
    idsWithinRadiusSet.add(nctId);
  }

  return { idsWithinRadius: Array.from(idsWithinRadiusSet), metaByNctId };
}

export async function fetchNearestTrialsPage(
  supabase: SupabaseClient,
  lat: number,
  lon: number,
  radiusMiles: number | null,
  pageSize: number,
  offset: number,
  conditionValues: string[] = [],
  statusValues: string[] = [],
): Promise<NearestTrialsPageResult> {
  const metaByNctId: Record<string, NearestSiteMeta> = {};
  const ids: string[] = [];

  const { data, error } = await supabase.rpc('nearest_active_trials_page', {
    in_lat: lat,
    in_lon: lon,
    max_miles: radiusMiles ?? null,
    page_limit: pageSize,
    page_offset: offset,
    condition_values: conditionValues.length > 0 ? conditionValues : null,
    status_values: statusValues.length > 0 ? statusValues : null,
  });

  if (error || !Array.isArray(data)) {
    if (error) console.warn('[trials] nearest_active_trials_page RPC failed', error);
    return { idsWithinRadius: [], metaByNctId: {}, totalCount: 0, error };
  }

  let totalCount = 0;
  for (const rawRow of data) {
    const row = rawRow as Record<string, unknown>;
    const nctId = toStringOrNull(row?.nct_id);
    if (!nctId) continue;

    const nearest_miles = toNumberOrNull(row?.nearest_miles);
    const distance_miles =
      nearest_miles != null && Number.isFinite(nearest_miles)
        ? Math.round(nearest_miles * 100) / 100
        : null;

    ids.push(nctId);
    totalCount = Math.max(totalCount, toNumberOrNull(row?.total_count) ?? 0);
    metaByNctId[nctId] = {
      nct_id: nctId,
      nearest_miles,
      distance_miles,
      city: toStringOrNull(row?.city),
      state_code: toStringOrNull(row?.state_code) ?? toStringOrNull(row?.state),
      facility_name: toStringOrNull(row?.facility_name),
      lat: toNumberOrNull(row?.lat),
      lon: toNumberOrNull(row?.lon),
      geocode_source: null,
    };
  }

  return { idsWithinRadius: ids, metaByNctId, totalCount };
}

export async function fetchNearestTrialsPageByBoundingBox(
  supabase: SupabaseClient,
  lat: number,
  lon: number,
  radiusMiles: number,
  pageSize: number,
  offset: number,
  conditionValues: string[] = [],
  statusValues: string[] = [],
): Promise<NearestTrialsPageResult> {
  const release = await supabase
    .from('pipeline_releases')
    .select('build_tag')
    .eq('status', 'active')
    .order('activated_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const buildTag = toStringOrNull(release.data?.build_tag);
  if (release.error || !buildTag) {
    return { idsWithinRadius: [], metaByNctId: {}, totalCount: 0, error: release.error };
  }

  const box = boundingBox(lat, lon, Math.max(radiusMiles, 5));
  const buildSitesQuery = (filterToActiveBuild: boolean) => {
    let query = supabase
      .from('trial_sites')
      .select('nct_id, city, state_code, facility_name, lat, lon')
      .gte('lat', box.minLat)
      .lte('lat', box.maxLat)
      .gte('lon', box.minLon)
      .lte('lon', box.maxLon)
      .limit(10000);

    if (filterToActiveBuild) {
      query = query.eq('build_tag', buildTag);
    }

    return query;
  };

  let sites = await buildSitesQuery(true);

  // Some deployments have active trials on a newer build_tag while trial_sites
  // still carries the prior build tag or null. Keep trial eligibility pinned to
  // the active trials build, but use any available site rows for distance.
  if (!sites.error && Array.isArray(sites.data) && sites.data.length === 0) {
    sites = await buildSitesQuery(false);
  }

  if (sites.error || !Array.isArray(sites.data)) {
    return { idsWithinRadius: [], metaByNctId: {}, totalCount: 0, error: sites.error };
  }

  const nearestByNctId = new Map<string, NearestSiteMeta>();
  for (const rawRow of sites.data) {
    const row = rawRow as Record<string, unknown>;
    const nctId = toStringOrNull(row.nct_id);
    const siteLat = toNumberOrNull(row.lat);
    const siteLon = toNumberOrNull(row.lon);
    if (!nctId || siteLat == null || siteLon == null) continue;

    const nearest_miles = distanceMiles(lat, lon, siteLat, siteLon);
    if (nearest_miles > radiusMiles) continue;

    const existing = nearestByNctId.get(nctId);
    if (existing?.nearest_miles != null && existing.nearest_miles <= nearest_miles) continue;

    nearestByNctId.set(nctId, {
      nct_id: nctId,
      nearest_miles,
      distance_miles: Math.round(nearest_miles * 100) / 100,
      city: toStringOrNull(row.city),
      state_code: toStringOrNull(row.state_code),
      facility_name: toStringOrNull(row.facility_name),
      lat: siteLat,
      lon: siteLon,
      geocode_source: null,
    });
  }

  const nearest = Array.from(nearestByNctId.values()).sort((a, b) => {
    const aMiles = a.nearest_miles ?? Number.POSITIVE_INFINITY;
    const bMiles = b.nearest_miles ?? Number.POSITIVE_INFINITY;
    return aMiles - bMiles || a.nct_id.localeCompare(b.nct_id);
  });

  if (nearest.length === 0) {
    return { idsWithinRadius: [], metaByNctId: {}, totalCount: 0 };
  }

  let eligibilityQuery = supabase
    .from('trials')
    .select('nct_id')
    .eq('build_tag', buildTag)
    .in('nct_id', nearest.slice(0, 2000).map((site) => site.nct_id));

  if (statusValues.length > 0) {
    eligibilityQuery = eligibilityQuery.in('status_bucket', statusValues);
  }
  if (conditionValues.length > 0) {
    eligibilityQuery = eligibilityQuery.overlaps('conditions', conditionValues);
  }

  const eligible = await eligibilityQuery;
  if (eligible.error || !Array.isArray(eligible.data)) {
    return { idsWithinRadius: [], metaByNctId: {}, totalCount: 0, error: eligible.error };
  }

  const eligibleIds = new Set(
    eligible.data
      .map((row) => toStringOrNull((row as Record<string, unknown>).nct_id))
      .filter((value): value is string => Boolean(value)),
  );
  const filtered = nearest.filter((site) => eligibleIds.has(site.nct_id));
  const page = filtered.slice(offset, offset + pageSize);
  const metaByNctId = Object.fromEntries(page.map((site) => [site.nct_id, site]));

  return {
    idsWithinRadius: page.map((site) => site.nct_id),
    metaByNctId,
    totalCount: filtered.length,
  };
}

export async function applyNearestMetaToTrials<T extends { nct_id?: string | null }>(
  trials: T[],
  metaByNctId: Record<string, NearestSiteMeta>,
) {
  return trials.map((trial) => {
    const rawId = trial?.nct_id;
    const nctId =
      typeof rawId === 'string'
        ? rawId
        : rawId != null
        ? String(rawId)
        : null;
    if (!nctId) return trial;
    const meta = metaByNctId[nctId];
    if (!meta) return trial;

    const augmented = trial as Record<string, unknown>;
    augmented.distance_miles = meta.distance_miles;
    augmented.nearest_site = {
      city: meta.city,
      state: meta.state_code, // Use state_code
      facility_name: meta.facility_name,
      distance_miles: meta.distance_miles,
      lat: meta.lat,
      lon: meta.lon,
      geocode_source: meta.geocode_source,
    };
    return trial;
  });
}

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
    // Return empty result so the page can fallback to standard matching (Tier B)
    return { idsWithinRadius: [], metaByNctId: {} };
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

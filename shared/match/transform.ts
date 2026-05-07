"use strict";

type Components = {
  eligibility: {
    value: number | null;
    reasons: string[];
  };
  logistics: {
    value: number | null;
    reasons: string[];
    distance_miles: number | null;
  };
  priority: {
    value: number | null;
    reasons: string[];
  };
};

type NearestSiteInput = Record<string, unknown> | null | undefined;

export type CompactMatchTrial = {
  nct_id: string;
  confidence: number;
  components: Components;
  nearest_site: { city: string | null; state: string | null; miles: number | null } | null;
  title?: string | null;
  phase?: string | null;
  status?: string | null;
  trial_url?: string | null;
  sponsor?: string | null;
  site_count?: number | null;
  visit_model?: string | null;
  min_age_years?: number | null;
  max_age_years?: number | null;
  gender?: string | null;
  distance_miles?: number | null;
  last_update_date?: string | null;
  reasons?: string[];
};

export function buildCompactMatchTrial(options: {
  nct_id: string;
  confidence: number | null | undefined;
  components: Components;
  nearest_site: NearestSiteInput;
  metadata?: {
    title?: string | null;
    phase?: string | null;
    status?: string | null;
    trial_url?: string | null;
    sponsor?: string | null;
    site_count?: number | null;
    visit_model?: string | null;
    min_age_years?: number | null;
    max_age_years?: number | null;
    gender?: string | null;
    distance_miles?: number | null;
    last_update_date?: string | null;
    reasons?: string[];
  };
}): CompactMatchTrial {
  const { nct_id, components } = options;
  const confidenceRaw =
    typeof options.confidence === "number" && Number.isFinite(options.confidence)
      ? options.confidence
      : 0;
  const confidence = Math.max(0, Math.min(100, Number(confidenceRaw.toFixed(2))));

  const source =
    options.nearest_site && typeof options.nearest_site === "object"
      ? (options.nearest_site as Record<string, unknown>)
      : {};

  const city =
    typeof source.city === "string" && source.city.trim().length > 0
      ? source.city.trim()
      : null;
  const state =
    typeof source.state === "string" && source.state.trim().length > 0
      ? source.state.trim()
      : null;
  const milesCandidate =
    typeof source.miles === "number" && Number.isFinite(source.miles)
      ? source.miles
      : typeof source.distance_miles === "number" &&
        Number.isFinite(source.distance_miles)
      ? source.distance_miles
      : null;
  const miles = milesCandidate != null ? Number(Number(milesCandidate).toFixed(2)) : null;

  const nearest_site =
    city || state || miles !== null
      ? {
          city,
          state,
          miles,
        }
      : null;

  const base: CompactMatchTrial = {
    nct_id,
    confidence,
    components,
    nearest_site,
  };

  if (options.metadata) {
    const meta = options.metadata;
    base.title = meta.title ?? null;
    base.phase = meta.phase ?? null;
    base.status = meta.status ?? null;
    base.trial_url = meta.trial_url ?? null;
    base.sponsor = meta.sponsor ?? null;
    base.site_count =
      typeof meta.site_count === "number" ? meta.site_count : meta.site_count ?? null;
    base.visit_model = meta.visit_model ?? null;
    base.min_age_years =
      typeof meta.min_age_years === "number" ? meta.min_age_years : meta.min_age_years ?? null;
    base.max_age_years =
      typeof meta.max_age_years === "number" ? meta.max_age_years : meta.max_age_years ?? null;
    base.gender = meta.gender ?? null;
    base.distance_miles =
      typeof meta.distance_miles === "number" && Number.isFinite(meta.distance_miles)
        ? Number(Number(meta.distance_miles).toFixed(2))
        : miles;
    base.last_update_date = meta.last_update_date ?? null;
    if (Array.isArray(meta.reasons)) {
      base.reasons = meta.reasons
        .filter(
          (reason): reason is string => typeof reason === "string" && reason.trim().length > 0,
        )
        .slice(0, 3);
    }
  } else {
    base.distance_miles = miles;
  }

  return base;
}

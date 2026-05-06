export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { cookies } from "next/headers";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getServerSupabase } from "@/lib/supabaseServer";
import AuroraBG from "@/components/AuroraBG";
import TrialSummary from "@/components/trial/TrialSummary";
import TrialEnrichments, { type TrialInsights } from "@/components/trial/TrialEnrichments";
import TrialHero from "@/components/trial/TrialHero";
import AtAGlance from "@/components/trial/AtAGlance";
import ExclusionCallout from "@/components/trial/ExclusionCallout";
import ParticipationEffort from "@/components/trial/ParticipationEffort";
import { decryptProfileToken } from "@/shared/profileCookie";
import { resolveZipToLatLon } from "@/shared/geo";

type PageProps = {
  params: Promise<{ nct_id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type TrialCore = {
  nct_id: string;
  title?: string | null;
  display_title?: string | null;
  sponsor?: string | null;
  phase?: string | null;
  status_bucket?: string | null;
  conditions?: string[] | null;
  site_count_us?: number | null;
  states_list?: string[] | null;
  data_as_of_date?: string | null;
  minimum_age?: string | null;
  maximum_age?: string | null;
  min_age_years?: number | null;
  max_age_years?: number | null;
  gender?: string | null;
};

type TrialSite = {
  facility_name?: string | null;
  city?: string | null;
  state?: string | null;
  lat?: number | null;
  lon?: number | null;
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeZip(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^\d{5}$/.test(trimmed) ? trimmed : null;
}

function buildHrefWithZip(path: string, zip?: string | null): string {
  if (!zip) return path;
  const params = new URLSearchParams({ zip });
  return `${path}?${params.toString()}`;
}

function isScreenableStatus(bucket?: string | null): boolean {
  const normalized = bucket?.trim().toLowerCase() ?? "";
  return normalized === "recruiting" || normalized === "active";
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusMiles = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
}

function buildLocationLabel(
  nearestSite: TrialSite | null,
  distanceMiles: number | null,
): string | null {
  if (!nearestSite) return null;
  const place = [nearestSite.city, nearestSite.state].filter(Boolean).join(", ");
  const facility = nearestSite.facility_name?.trim() || null;
  const roundedDistance =
    typeof distanceMiles === "number" && Number.isFinite(distanceMiles)
      ? Math.round(distanceMiles)
      : null;

  if (facility && place && roundedDistance != null) {
    return `${facility} (${place}) · ~${roundedDistance} mi`;
  }
  if (place && roundedDistance != null) {
    return `${place} · ~${roundedDistance} mi`;
  }
  if (facility && roundedDistance != null) {
    return `${facility} · ~${roundedDistance} mi`;
  }
  return facility || place || null;
}

function normalizePhaseLabel(phase?: string | null): string | null {
  if (!phase) return null;
  const raw = phase.trim();
  const key = raw.toUpperCase().replace(/[\s_-]+/g, "");
  if (["NA", "N/A", "NOTAPPLICABLE"].includes(key)) return null;
  const cleaned = raw.replace(/PHASE\s*/gi, "Phase ").replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function cleanSentence(value?: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function buildFallbackSummary(
  trial: TrialCore,
  insights: TrialInsights | null,
): string | null {
  const sentences: string[] = [];
  const phase = normalizePhaseLabel(trial.phase);
  const firstCondition =
    Array.isArray(trial.conditions) && trial.conditions.length > 0
      ? cleanSentence(trial.conditions[0]?.replace(/_/g, " "))
      : null;
  const firstDrug = insights?.drug_classes_json?.[0];
  const drugName = cleanSentence(firstDrug?.drug_name ?? firstDrug?.drug_class ?? null);
  const primaryEndpoint = insights?.endpoint_categories_json?.find(
    (entry) => String(entry.outcome_type ?? "").toLowerCase() === "primary",
  );
  const endpointText = cleanSentence(
    primaryEndpoint?.endpoint ?? primaryEndpoint?.endpoint_category ?? null,
  );

  if (drugName && firstCondition) {
    const studyLabel = phase ? `This ${phase} study` : "This study";
    sentences.push(`${studyLabel} is testing ${drugName} in people with ${firstCondition}.`);
  } else if (firstCondition) {
    const studyLabel = phase ? `This ${phase} study` : "This study";
    sentences.push(`${studyLabel} is focused on people with ${firstCondition}.`);
  } else if (trial.display_title) {
    sentences.push(`This clinical trial investigates ${trial.display_title.trim()}.`);
  }

  if (endpointText) {
    sentences.push(`The primary outcome being measured is ${endpointText.replace(/[.]$/, "")}.`);
  }

  return sentences.length > 0 ? sentences.join(" ") : null;
}

export default async function TrialDetailPage({ params, searchParams }: PageProps) {
  const { nct_id } = await params;
  const resolvedSearchParams = await searchParams;
  const normalizedNct = (nct_id || "").toUpperCase();
  const supabase = getServerSupabase();
  const cookieStore = await cookies();
  const profileCookieStr = cookieStore.get("pm_profile")?.value;
  let profile = null;
  if (profileCookieStr) {
    try {
      profile = await decryptProfileToken(profileCookieStr);
    } catch {
      profile = null;
    }
  }
  const effectiveZip = normalizeZip(resolvedSearchParams.zip) ?? normalizeZip(profile?.zip) ?? null;

  let trialRes = await supabase
    .from("trials_serving_latest")
    .select(
      "nct_id, title, display_title, sponsor, phase, status_bucket, conditions, states_list, site_count_us, data_as_of_date, minimum_age, maximum_age, min_age_years, max_age_years, gender",
    )
    .eq("nct_id", normalizedNct)
    .single();

  let trial = trialRes.data as TrialCore | null;
  if (trialRes.error || !trial) {
    const byId = await supabase
      .from("trials_serving_latest")
      .select(
        "nct_id, title, display_title, sponsor, phase, status_bucket, conditions, states_list, site_count_us, data_as_of_date, minimum_age, maximum_age, min_age_years, max_age_years, gender",
      )
      .eq("id", normalizedNct)
      .single();
    trial = byId.data as TrialCore | null;
    if (!trial) {
      return (
        <main className="pb-16 pt-12">
          <div className="pm-container">
            <div className="mx-auto max-w-2xl rounded-lg bg-white/90 p-8 text-center backdrop-blur-sm">
              <h1 className="pm-heading-2 text-foreground">Trial not found</h1>
              <p className="pm-body mt-3 text-muted-foreground">
                We couldn’t find this study. It may have been removed or is temporarily unavailable.
              </p>
              <div className="mt-6 flex items-center justify-center gap-4 text-primary">
                <Link className="underline" href="/trials">
                  Browse trials
                </Link>
                <Link className="underline" href="/trials">
                  Try quick match
                </Link>
              </div>
            </div>
          </div>
        </main>
      );
    }
  }

  const insightsRes = await supabase
    .from("trial_insights_latest")
    .select(
      "plain_summary_json, patient_insights_json, top_disqualifiers_json, burden_score, logistics_score, strictness_score, condition_body_systems_json, drug_classes_json, drug_routes_json, endpoint_categories_json, procedure_categories_json, device_categories_json",
    )
    .eq("nct_id", trial.nct_id)
    .maybeSingle();
  const insights = (insightsRes.data ?? null) as TrialInsights | null;

  const displayTitle = trial.display_title || trial.title || `Clinical trial ${trial.nct_id}`;
  const zipLocation = effectiveZip ? await resolveZipToLatLon(effectiveZip, supabase as any) : null;

  let nearestSite: TrialSite | null = null;
  let nearestSiteDistanceMiles: number | null = null;

  if (zipLocation) {
    const { data: siteRows } = await supabase
      .from("trial_sites")
      .select("facility_name, city, state, lat, lon")
      .eq("nct_id", trial.nct_id);

    if (Array.isArray(siteRows) && siteRows.length > 0) {
      let bestDistance = Number.POSITIVE_INFINITY;
      let bestSite: TrialSite | null = null;

      for (const rawSite of siteRows as TrialSite[]) {
        const lat = toNumber(rawSite.lat);
        const lon = toNumber(rawSite.lon);
        if (lat == null || lon == null) continue;

        const miles = haversineDistance(zipLocation.lat, zipLocation.lon, lat, lon);
        if (miles < bestDistance) {
          bestDistance = miles;
          bestSite = rawSite;
        }
      }

      if (bestSite && Number.isFinite(bestDistance)) {
        nearestSite = bestSite;
        nearestSiteDistanceMiles = bestDistance;
      }
    }
  }

  const locationLabel = buildLocationLabel(nearestSite, nearestSiteDistanceMiles);
  const detailScreenerHref = buildHrefWithZip(`/trial/${trial.nct_id}/screen`, effectiveZip);
  const isScreenable = isScreenableStatus(trial.status_bucket);

  const plainSummaryObj = typeof insights?.plain_summary_json === "object" ? insights.plain_summary_json as Record<string, any> : null;
  const designObj = plainSummaryObj?.structured?.design as Record<string, any> | undefined;

  return (
    <main className="relative min-h-screen pb-16 pt-12" data-route="trial-detail">
      <AuroraBG className="fixed inset-0 z-0 opacity-70" intensity="calm" />
      <div className="pm-container">
        <div className="mx-auto max-w-5xl space-y-10">
          <TrialHero
            nctId={trial.nct_id}
            displayTitle={displayTitle}
            officialTitle={trial.title}
            statusBucket={trial.status_bucket}
            sponsor={trial.sponsor}
            conditions={Array.isArray(trial.conditions) ? trial.conditions : null}
            dataAsOfDate={trial.data_as_of_date ?? null}
            screenerHref={detailScreenerHref}
          />

          <AtAGlance trial={trial} insights={insights} locationLabel={locationLabel} />

          <TrialSummary
            insights={insights}
            fallbackSummary={buildFallbackSummary(trial, insights)}
          />

          <ParticipationEffort
            isRemote={insights?.logistics_score === 100}
            interventionModes={insights?.patient_insights_json?.intervention_modes}
            drugRoutes={insights?.drug_routes_json?.map((dr) => dr.route).filter(Boolean) as string[]}
            masking={designObj?.masking}
            allocation={designObj?.allocation}
            interventionModel={designObj?.intervention_model}
          />

          <ExclusionCallout raw={insights?.top_disqualifiers_json} />

          <TrialEnrichments insights={insights} />

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2">
            {isScreenable && (
              <Link
                href={detailScreenerHref}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
              >
                Screen for this study
              </Link>
            )}
            <a
              href={`https://clinicaltrials.gov/study/${trial.nct_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View on ClinicalTrials.gov
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

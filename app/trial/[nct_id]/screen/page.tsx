export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getServerSupabase } from "@/lib/supabaseServer";
import TrialScreenClient from "./TrialScreenClient";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import AuroraBG from "@/components/AuroraBG";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { readProfileCookie } from "@/shared/profileCookie";
import { pmqToUiQuestions } from "@/lib/pmqAdapter";
import { parseAgeToYears } from "@/lib/trials/age";

type PageProps = {
  params: Promise<{ nct_id: string }>;
  searchParams: Promise<{ debug?: string; mode?: string; age?: string; sex?: string; zip?: string; condition?: string; conditions?: string } | undefined>;
};

function getFriendlyTitle(title: string): string {
  if (!title) return "Study overview";
  const trimmed = title.trim();
  const patterns = [
    /^(?:(?:a|an)\s+)?(?:phase\s+[0-4]\s+)?(?:randomi[sz]ed\s+)?(?:double\s+blind\s+)?(?:pilot\s+)?(?:study|trial)\s+(?:to|of|for|evaluating|assessing)\s*/i,
    /^pilot\s+(?:study|trial)\s+(?:to|of|for)\s*/i,
  ];
  let friendly = trimmed;
  for (const pattern of patterns) {
    friendly = friendly.replace(pattern, "");
  }
  friendly = friendly.replace(/\s+-\s+.*$/, "").replace(/\s*\(.*?\)\s*$/, "").trim();
  if (friendly.length < 24) friendly = trimmed;
  if (friendly.length > 140) {
    friendly = `${friendly.slice(0, 137).trimEnd()}…`;
  }
  return friendly;
}

export default async function TrialScreenPage({ params, searchParams }: PageProps) {
  const { nct_id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const debug = process.env.NODE_ENV === "production" ? undefined : resolvedSearchParams.debug;
  const { mode: rawMode } = resolvedSearchParams;
  const ageParam = resolvedSearchParams["age"];
  const sexParam = resolvedSearchParams["sex"];
  const zipParam = resolvedSearchParams["zip"];
  const conditionParam = resolvedSearchParams["condition"] ?? resolvedSearchParams["conditions"];
  const normalizedNct = (nct_id || '').toUpperCase();
  const mode = rawMode === "clinic" ? "clinic" : "patient";
  const clinicPreview = mode === "clinic";

  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const host = hdrs.get("host") ?? "localhost";
  const urlParams = new URLSearchParams();
  if (debug) urlParams.set("debug", debug);
  urlParams.set("mode", mode);
  const querySegment = urlParams.toString();
  const requestUrl = `${proto}://${host}/trial/${normalizedNct}/screen${querySegment ? `?${querySegment}` : ""}`;
  const cookieHeader = hdrs.get("cookie") ?? "";
  const request = new NextRequest(requestUrl, {
    headers: new Headers(cookieHeader ? { cookie: cookieHeader } : undefined),
  });
  const profileCookie = await readProfileCookie(request);

  const supabase = getServerSupabase();

  // Explicit column selection aligned to current trials schema
  let trialRes = await supabase
    .from("trials_serving_latest")
    .select(
      "nct_id, title, display_title, sponsor, phase, status, status_bucket, conditions, states_list, questionnaire_json, quality_score, minimum_age, maximum_age, min_age_years, max_age_years, gender, site_count_us",
    )
    .eq("nct_id", normalizedNct)
    .single();

  let trial = trialRes.data as any;

  if (trialRes.error || !trial) {
    // Try by internal numeric/string id with explicit columns
    const byId = await supabase
      .from("trials_serving_latest")
      .select(
        "nct_id, title, display_title, sponsor, phase, status, status_bucket, conditions, states_list, questionnaire_json, quality_score, minimum_age, maximum_age, min_age_years, max_age_years, gender, site_count_us",
      )
      .eq("id", nct_id)
      .single();
    trial = byId.data as any;
    if (trial) {
      // Redirect to canonical NCT path if we matched by internal id
      const canonicalParams = new URLSearchParams();
      canonicalParams.set("mode", mode);
      if (debug) canonicalParams.set("debug", debug);
      const canonicalQuery = canonicalParams.toString();
      const canonical = `/trial/${trial.nct_id.toUpperCase()}/screen${canonicalQuery ? `?${canonicalQuery}` : ""}`;
      return (
        <meta httpEquiv="refresh" content={`0; url=${canonical}`} />
      ) as any;
    }
  }

  if (!trial) {
    return (
      <main className="pb-16 pt-12" data-route="screener">
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

  const initialProfile = profileCookie ?? null;
  const selectedConditionSlug =
    (typeof conditionParam === "string" && conditionParam.trim().length > 0
      ? conditionParam.trim()
      : Array.isArray(initialProfile?.conditions) && initialProfile.conditions.length > 0
        ? initialProfile.conditions[0]
        : null) ?? null;
  const profileForPmq = initialProfile
    ? {
      age_years: initialProfile.age,
      sex_at_birth: initialProfile.sex,
      zip: zipParam ?? initialProfile.zip,
    }
    : zipParam
      ? { zip: zipParam }
      : undefined;
  const { mainQuestions, optionalQuestions, initialAnswers: pmqAnswers } = pmqToUiQuestions(
    trial.questionnaire_json,
    profileForPmq,
  );
  const uiQuestions = mainQuestions; // Main questions for the screener flow

  const querySeeds: Record<string, unknown> = {};
  const parsedAge = typeof ageParam === "string" ? parseInt(ageParam, 10) : NaN;
  if (Number.isFinite(parsedAge) && parsedAge > 0) {
    querySeeds.age = parsedAge;
    querySeeds.age_years = parsedAge;
    querySeeds.dem_age = parsedAge;
  }
  if (typeof sexParam === "string" && sexParam.trim().length > 0) {
    querySeeds.sex = sexParam.trim();
    querySeeds.gender = sexParam.trim();
    querySeeds.dem_sex = sexParam.trim();
  }
  if (typeof zipParam === "string" && zipParam.trim().length > 0) {
    querySeeds.zip = zipParam.trim();
  }
  if (typeof conditionParam === "string" && conditionParam.trim().length > 0) {
    const cond = conditionParam.trim();
    querySeeds.condition = cond;
    querySeeds.conditions = [cond];
    querySeeds.selected_condition = cond;
    querySeeds.diagnosis_confirmed = true;
    querySeeds.diagnosis = true;
  } else if (selectedConditionSlug) {
    querySeeds.condition = selectedConditionSlug;
    querySeeds.conditions = [selectedConditionSlug];
    querySeeds.selected_condition = selectedConditionSlug;
    querySeeds.diagnosis_confirmed = true;
    querySeeds.diagnosis = true;
  }
  const initialAnswers = { ...pmqAnswers, ...querySeeds };

  if (process.env.NODE_ENV !== "production") {
    console.info("[screener:prefill sources]", {
      routeKeys: Object.keys(querySeeds),
      profileKeys: initialProfile
        ? Object.keys(initialProfile).filter(
          (key) => (initialProfile as Record<string, unknown>)[key] !== undefined,
        )
        : [],
      precedence: "route_over_profile",
    });
  }

  const displayTitle = trial.display_title || trial.title;
  const minAgeYears =
    typeof trial.min_age_years === "number" ? trial.min_age_years : parseAgeToYears(trial.minimum_age);
  const maxAgeYears =
    typeof trial.max_age_years === "number" ? trial.max_age_years : parseAgeToYears(trial.maximum_age);
  const siteCount = typeof trial.site_count_us === "number" ? trial.site_count_us : null;
  const states = Array.isArray(trial.states_list)
    ? trial.states_list.filter(Boolean)
    : [];
  const statesPreview = states.slice(0, 4).join(", ");
  const statesSuffix = states.length > 4 ? ` +${states.length - 4}` : "";
  const sitesDisplay =
    siteCount != null
      ? `${siteCount} US site${siteCount === 1 ? "" : "s"}${statesPreview ? ` in ${statesPreview}${statesSuffix}` : ""}`
      : statesPreview
      ? `Sites in ${statesPreview}${statesSuffix}`
      : null;

  return (
    <main className="relative min-h-screen pb-16 pt-12" data-route="screener">
      <AuroraBG className="fixed inset-0 z-0 opacity-70" intensity="calm" />
      <div className="pm-container">
        <div className="mx-auto max-w-4xl space-y-10">
          <header className="space-y-4 border-b border-border/60 pb-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
              Screener
            </p>
            <h1 className="font-heading text-[32px] font-semibold leading-tight text-foreground md:text-[38px]">
              Eligibility screening
            </h1>
            <p className="text-lg font-medium leading-relaxed text-foreground md:text-xl line-clamp-2">
              {getFriendlyTitle(displayTitle)}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Sponsored by {trial.sponsor || "Not listed"}</span>
              <span aria-hidden="true">·</span>
              <Link
                href={`/trial/${trial.nct_id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary transition hover:text-primary/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                Study details
              </Link>
              <span aria-hidden="true">·</span>
              <Link
                href={`https://clinicaltrials.gov/study/${trial.nct_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary transition hover:text-primary/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                ClinicalTrials.gov
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
            {sitesDisplay && (
              <p className="text-sm text-muted-foreground">
                {sitesDisplay}
              </p>
            )}
          </header>

          <TrialScreenClient
            trial={{
              nct_id: trial.nct_id,
              title: displayTitle,
              sponsor: trial.sponsor,
              condition: Array.isArray(trial.conditions)
                ? trial.conditions[0]
                : typeof trial.conditions === "string"
                  ? trial.conditions
                  : undefined,
              conditionSlug: selectedConditionSlug,
              min_age_years: minAgeYears,
              max_age_years: maxAgeYears,
              gender: trial.gender ?? null,
              questionnaire_json: trial.questionnaire_json ?? null,
            }}
            precalculatedQuestions={uiQuestions}
            optionalQuestions={optionalQuestions}
            initialAnswers={initialAnswers}
            initialProfile={initialProfile}
            profileForPmq={profileForPmq}
            showDebug={debug === "1"}
            clinicPreview={clinicPreview}
          />
        </div>
      </div>
    </main>
  );
}

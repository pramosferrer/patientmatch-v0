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

type PageProps = {
  params: Promise<{ nct_id: string }>;
  searchParams: Promise<{ prefill?: string; debug?: string; mode?: string } | undefined>;
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
  if (process.env.NODE_ENV !== "production") {
    console.log("[trial:params]", { nct_id });
  }
  const resolvedSearchParams = (await searchParams) ?? {};
  const { prefill, debug, mode: rawMode } = resolvedSearchParams;
  const ageParam = resolvedSearchParams["age"];
  const sexParam = resolvedSearchParams["sex"];
  const conditionParam = resolvedSearchParams["condition"] ?? resolvedSearchParams["conditions"];
  const normalizedNct = (nct_id || '').toUpperCase();
  const mode = rawMode === "clinic" ? "clinic" : "patient";
  const clinicPreview = mode === "clinic";

  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const host = hdrs.get("host") ?? "localhost";
  const urlParams = new URLSearchParams();
  if (prefill) urlParams.set("prefill", prefill);
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

  if (process.env.NODE_ENV !== "production") {
    const rawRes = await supabase
      .from("trials")
      .select(
        "nct_id, title, sponsor, phase, status, status_bucket, conditions, states_list, questionnaire_json, quality_score",
      )
      .eq("nct_id", nct_id)
      .single();
    console.log("[trial:raw fetch]", {
      error: rawRes.error,
      hasData: Boolean(rawRes.data),
      dataKeys: rawRes.data ? Object.keys(rawRes.data) : [],
      fetchedNct: rawRes.data?.nct_id ?? null,
    });
    if (rawRes.error) {
      const minimalRes = await supabase
        .from("trials")
        .select("nct_id, title, questionnaire_json")
        .eq("nct_id", nct_id)
        .single();
      console.log("[trial:minimal fetch]", {
        error: minimalRes.error,
        hasData: Boolean(minimalRes.data),
        dataKeys: minimalRes.data ? Object.keys(minimalRes.data) : [],
        fetchedNct: minimalRes.data?.nct_id ?? null,
      });
    }
  }

  // Explicit column selection aligned to current trials schema
  let trialRes = await supabase
    .from("trials")
    .select(
      "nct_id, title, sponsor, phase, status, status_bucket, conditions, states_list, questionnaire_json, quality_score",
    )
    .eq("nct_id", normalizedNct)
    .single();
  if (process.env.NODE_ENV !== "production") {
    console.log("[trial:filtered fetch]", { data: trialRes.data, error: trialRes.error });
  }

  let trial = trialRes.data as any;

  if (trialRes.error || !trial) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('screener load', { paramNct: nct_id, fetchedNct: null, source: 'nct_id miss' });
    }
    // Try by internal numeric/string id with explicit columns
    const byId = await supabase
      .from("trials")
      .select(
        "nct_id, title, sponsor, phase, status, status_bucket, conditions, states_list, questionnaire_json, quality_score",
      )
      .eq("id", nct_id)
      .single();
    trial = byId.data as any;
    if (trial) {
      if (process.env.NODE_ENV !== 'production') {
        console.info('screener load', { paramNct: nct_id, fetchedNct: trial.nct_id, source: 'id' });
      }
      // Redirect to canonical NCT path if we matched by internal id
      const canonicalParams = new URLSearchParams();
      canonicalParams.set("mode", mode);
      if (prefill) canonicalParams.set("prefill", prefill);
      if (debug) canonicalParams.set("debug", debug);
      const canonicalQuery = canonicalParams.toString();
      const canonical = `/trial/${trial.nct_id.toUpperCase()}/screen${canonicalQuery ? `?${canonicalQuery}` : ""}`;
      return (
        <meta httpEquiv="refresh" content={`0; url=${canonical}`} />
      ) as any;
    }
  }

  if (!trial) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('screener load', { paramNct: nct_id, fetchedNct: null, source: 'not found' });
    }
    return (
      <main className="pb-16 pt-12" data-route="screener">
        <div className="pm-container">
          <div className="mx-auto max-w-2xl rounded-none bg-white/90 p-8 text-center backdrop-blur-sm">
            <h1 className="pm-heading-2 text-foreground">Trial not found</h1>
            <p className="pm-body mt-3 text-muted-foreground">
              We couldn’t find this study. It may have been removed or is temporarily unavailable.
            </p>
            <div className="mt-6 flex items-center justify-center gap-4 text-primary">
              <Link className="underline" href="/trials">
                Browse trials
              </Link>
              <Link className="underline" href="/match">
                Try quick match
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[screener:profile seed]", {
      profileAge: profileCookie?.age ?? null,
      profileSex: profileCookie?.sex ?? null,
      trialMinAge: null,
      trialMaxAge: null,
      trialGender: null,
    });
  }

  const initialProfile = profileCookie ?? null;
  const profileForPmq = initialProfile
    ? {
      age_years: initialProfile.age,
      sex_at_birth: initialProfile.sex,
      zip: initialProfile.zip,
    }
    : undefined;
  const { mainQuestions, optionalQuestions, initialAnswers: pmqAnswers } = pmqToUiQuestions(
    trial.questionnaire_json,
    profileForPmq,
  );
  const uiQuestions = mainQuestions; // Main questions for the screener flow

  // Parse prefill data safely
  let prefillData = {};
  if (prefill) {
    try {
      prefillData = JSON.parse(decodeURIComponent(prefill));
    } catch (error) {
      console.warn('Failed to parse prefill data:', error);
    }
  }

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
  if (typeof conditionParam === "string" && conditionParam.trim().length > 0) {
    const cond = conditionParam.trim();
    querySeeds.condition = cond;
    querySeeds.conditions = [cond];
  }
  prefillData = { ...querySeeds, ...prefillData };
  const initialAnswers = { ...pmqAnswers, ...prefillData };

  if (process.env.NODE_ENV !== "production") {
    console.info("[screener:prefill sources]", {
      routeKeys: Object.keys(prefillData),
      profileKeys: initialProfile
        ? Object.keys(initialProfile).filter(
          (key) => (initialProfile as Record<string, unknown>)[key] !== undefined,
        )
        : [],
      precedence: "route_over_profile",
    });
  }

  return (
    <main className="relative min-h-screen pb-16 pt-12" data-route="screener">
      <AuroraBG className="fixed inset-0 z-0 opacity-70" intensity="calm" />
      <div className="pm-container">
        <div className="mx-auto max-w-4xl space-y-10">
          <header className="space-y-4 border-b border-border/60 pb-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
              Screener
            </p>
            <h1 className="text-[32px] font-semibold leading-tight text-foreground md:text-[38px]">
              Eligibility screening
            </h1>
            <p className="text-lg font-medium leading-relaxed text-foreground md:text-xl line-clamp-2">
              {getFriendlyTitle(trial.title)}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Sponsored by {trial.sponsor || "Not listed"}</span>
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
          </header>

          <TrialScreenClient
            trial={{
              nct_id: trial.nct_id,
              title: trial.title,
              sponsor: trial.sponsor,
              condition: Array.isArray(trial.conditions)
                ? trial.conditions[0]
                : typeof trial.conditions === "string"
                  ? trial.conditions
                  : undefined,
              conditionSlug: null,
              min_age_years: null,
              max_age_years: null,
              gender: null,
            }}
            precalculatedQuestions={uiQuestions}
            optionalQuestions={optionalQuestions}
            initialAnswers={initialAnswers}
            initialProfile={initialProfile}
            showDebug={debug === "1"}
            clinicPreview={clinicPreview}
          />
        </div>
      </div>
    </main>
  );
}

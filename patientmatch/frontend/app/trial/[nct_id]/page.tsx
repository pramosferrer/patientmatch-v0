export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type PageProps = {
  params: Promise<{ nct_id: string }>;
};

export default async function TrialDetailPage({ params }: PageProps) {
  const { nct_id } = await params;
  const normalizedNct = (nct_id || "").toUpperCase();
  const supabase = getServerSupabase();

  let trialRes = await supabase
    .from("trials_serving_latest")
    .select(
      "nct_id, title, display_title, sponsor, phase, status_bucket, conditions, states_list, site_count_us, data_as_of_date, minimum_age, maximum_age, min_age_years, max_age_years, gender",
    )
    .eq("nct_id", normalizedNct)
    .single();

  let trial = trialRes.data as any;
  if (trialRes.error || !trial) {
    const byId = await supabase
      .from("trials_serving_latest")
      .select(
        "nct_id, title, display_title, sponsor, phase, status_bucket, conditions, states_list, site_count_us, data_as_of_date, minimum_age, maximum_age, min_age_years, max_age_years, gender",
      )
      .eq("id", normalizedNct)
      .single();
    trial = byId.data as any;
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
      "plain_summary_json, patient_insights_json, top_disqualifiers_json, burden_score, logistics_score, condition_body_systems_json, drug_classes_json, drug_routes_json, endpoint_categories_json, procedure_categories_json, device_categories_json",
    )
    .eq("nct_id", trial.nct_id)
    .maybeSingle();
  const insights = (insightsRes.data ?? null) as TrialInsights | null;

  const displayTitle = trial.display_title || trial.title;

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
          />

          <AtAGlance trial={trial} insights={insights} />

          <TrialSummary insights={insights} />

          <ParticipationEffort
            burdenScore={insights?.burden_score}
            logisticsScore={insights?.logistics_score}
          />

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="study-details" className="border rounded-xl px-4 bg-white/60 backdrop-blur-sm">
              <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline py-3">
                Study details
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <TrialEnrichments insights={insights} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <ExclusionCallout raw={insights?.top_disqualifiers_json} />

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2">
            <Link
              href={`/trial/${trial.nct_id}/screen`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
            >
              Check if I qualify
            </Link>
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

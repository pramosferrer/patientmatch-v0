export const dynamic = 'force-dynamic';

import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getConditionCatalog } from '@/shared/conditions.catalog';
import { CONDITION_DETAILS } from '@/shared/conditions';
import { toConditionSlug } from '@/shared/conditions-normalize';
import { getServerSupabase } from '@/lib/supabaseServer';
import { getConditionHex } from '@/components/icons/ConditionIcon';
import JsonLd from '@/components/trials/JsonLd';
import PublicTrialCard, { type PublicTrial } from '@/components/trials/PublicTrialCard';
import MicroScreener from '@/components/marketing/MicroScreener';
import { Button } from '@/components/ui/button';

const WHAT_TO_EXPECT = [
  {
    label: 'Screening',
    desc: 'A short eligibility check — usually 5–10 minutes online or by phone. No commitment required.',
  },
  {
    label: 'Your visit schedule',
    desc: 'Varies by trial. Many offer remote check-ins. Travel and time costs are often reimbursed.',
  },
  {
    label: 'Your rights',
    desc: 'You can withdraw from a trial at any time, for any reason, with no impact on your regular care.',
  },
  {
    label: 'Who to contact',
    desc: 'Use the official ClinicalTrials.gov listing to decide what to ask your clinician or the study team.',
  },
];

const FALLBACK_TRIAL_TYPES = ['Medication studies', 'Lifestyle programs', 'Support tools'];
const FALLBACK_INTERVENTIONS = ['Therapeutic treatments', 'Monitoring tools', 'Care programs'];

function getConditionDetail(slug: string, label: string) {
  const known = CONDITION_DETAILS[slug];
  return {
    description: known?.description ?? `Clinical trials for ${label} and related care.`,
    trialTypes: known?.trialTypes?.length ? known.trialTypes : FALLBACK_TRIAL_TYPES,
    interventions: known?.interventions?.length ? known.interventions : FALLBACK_INTERVENTIONS,
  };
}

function buildConditionFilters(label: string, slug: string, synonyms?: string[]) {
  const values = new Set<string>();
  values.add(slug);
  values.add(label);
  (synonyms ?? []).forEach((s) => { const t = s.trim(); if (t) values.add(t); });
  return Array.from(values);
}

type ConditionTrial = PublicTrial & { data_as_of_date?: string | null };

export async function generateStaticParams() {
  const catalog = await getConditionCatalog();
  return catalog.all.slice(0, 50).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = toConditionSlug(rawSlug);
  if (!slug || slug === 'other') return { title: 'Condition not found' };
  const catalog = await getConditionCatalog();
  const condition = catalog.all.find((i) => i.slug === slug);
  if (!condition) return { title: 'Condition not found' };
  const detail = getConditionDetail(slug, condition.label);
  return {
    title: `${condition.label} clinical trials`,
    description: detail.description,
  };
}

export default async function ConditionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = toConditionSlug(rawSlug);
  if (!slug || slug === 'other') notFound();

  const catalog = await getConditionCatalog();
  const condition = catalog.all.find((i) => i.slug === slug);
  if (!condition) notFound();

  const detail = getConditionDetail(slug, condition.label);
  const hex = getConditionHex(slug);

  const supabase = getServerSupabase();
  const filterValues = buildConditionFilters(condition.label, slug, condition.synonyms);
  let query = supabase
    .from('trials_serving_latest')
    .select('nct_id, title, display_title, status_bucket, conditions, quality_score, data_as_of_date, site_count_us, states_list');

  if (filterValues.length > 0) query = query.overlaps('conditions', filterValues);

	  const { data: trialsData } = await query
	    .eq('status_bucket', 'Recruiting')
	    .order('data_as_of_date', { ascending: false, nullsFirst: false })
	    .order('quality_score', { ascending: false, nullsFirst: false })
	    .limit(80);

	  const trials = (trialsData ?? []) as ConditionTrial[];
	  const recentTrials = trials.slice(0, Math.min(6, trials.length));
	  const recruitingCount = trials.length;
	  const recruitingTrialsHref = `/trials?condition=${slug}&status_bucket=recruiting`;

  return (
    <>
      <JsonLd trials={trials} />
      <main>
        {/* ── Header band ─────────────────────────────────── */}
        <section
          className="relative overflow-hidden border-b border-border/40 pb-14 pt-14"
          style={{ background: `linear-gradient(180deg, ${hex}07 0%, transparent 100%)` }}
        >
          {/* Left-side radial glow */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: `radial-gradient(ellipse 50% 90% at -5% 50%, ${hex}09, transparent)` }}
          />

          <div className="pm-container relative">
            {/* Back link */}
            <Link
              href="/conditions"
              className="mb-7 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              ← All conditions
            </Link>

            <div className="grid gap-12 lg:grid-cols-[1fr_auto] lg:items-start">
              {/* Left */}
              <div>
                {/* Condition name */}
                <h1
                  className="mb-4 font-display font-normal text-foreground tracking-[-0.024em] leading-[1.06]"
                  style={{ fontSize: 'clamp(44px,5.5vw,68px)' }}
                >
                  {condition.label}
                </h1>

                {/* Trial count as hero stat */}
                <div
                  className="mb-[18px] font-display font-light tracking-[-0.03em] tabular-nums"
                  style={{ fontSize: 'clamp(28px,3.5vw,44px)', color: hex }}
                >
	                  {recruitingCount > 0
	                    ? `${recruitingCount.toLocaleString()} recruiting trials`
	                    : 'No recruiting trials yet'}
                </div>

                {/* Description */}
                <p className="mb-7 max-w-[540px] text-[17px] leading-relaxed text-muted-foreground">
                  {detail.description}
                </p>

                {/* CTAs */}
                <div className="mb-7 flex items-center gap-3">
                  <Button
                    asChild
                    variant="brand"
                    className="h-11 px-6 shadow-[0_4px_18px_rgba(45,155,112,0.26)]"
                  >
	                    <Link href={recruitingTrialsHref}>Find my match</Link>
                  </Button>
                  <Link
	                    href={recruitingTrialsHref}
                    className="text-[15px] font-medium transition-opacity hover:opacity-75"
                    style={{ color: hex }}
                  >
	                    Browse recruiting trials →
                  </Link>
                </div>

                {/* Meta badges */}
                <div className="flex flex-wrap gap-2">
	                  {['50 states', '35% with remote options', 'Refreshed daily', 'Free to join'].map(
                    (badge) => (
                      <span
                        key={badge}
                        className="rounded-full border border-border/50 bg-white/80 px-3 py-1 text-[12px] font-medium text-muted-foreground"
                      >
                        {badge}
                      </span>
                    ),
                  )}
                </div>
              </div>

              {/* Right: Quick start screener */}
              <div className="w-full lg:w-[280px] lg:shrink-0">
                <MicroScreener conditionSlug={slug} conditionLabel={condition.label} />
              </div>
            </div>
          </div>
        </section>

        {/* ── Editorial content ────────────────────────────── */}
        <div className="pm-container pb-20 pt-14">
          <div className="grid gap-16 md:grid-cols-2">
            {/* What trials involve */}
            <div>
              <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
                What trials involve
              </div>
              <div className="flex flex-col">
                {detail.trialTypes.map((type, i) => (
                  <div
                    key={type}
                    className={`grid grid-cols-[20px_1fr] gap-4 py-[18px] ${
                      i < detail.trialTypes.length - 1 ? 'border-b border-border/40' : ''
                    }`}
                  >
                    <span
                      className="mt-[2px] text-[13px] font-bold"
                      style={{ color: hex }}
                    >
                      ✓
                    </span>
                    <div>
                      <div className="mb-1 text-[15.5px] font-semibold text-foreground">{type}</div>
                      {detail.interventions[i] && (
                        <p className="text-[13.5px] text-muted-foreground">
                          Examples: {detail.interventions[i]}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* What to expect */}
            <div>
              <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
                What to expect
              </div>
              <div className="flex flex-col">
                {WHAT_TO_EXPECT.map((item, i) => (
                  <div
                    key={item.label}
                    className={`py-4 ${i < WHAT_TO_EXPECT.length - 1 ? 'border-b border-border/40' : ''}`}
                  >
                    <div className="mb-[5px] text-[15px] font-semibold text-foreground">
                      {item.label}
                    </div>
                    <p className="text-[14px] leading-relaxed text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Trials enrolling now ──────────────────────── */}
          {recentTrials.length > 0 && (
            <section className="mt-16">
              <div className="mb-6 flex items-baseline justify-between gap-4 flex-wrap">
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
                    Recent opportunities
                  </div>
                  <h2
                    className="font-display font-normal text-foreground tracking-[-0.015em]"
                    style={{ fontSize: 28 }}
                  >
                    Trials enrolling now
                  </h2>
                </div>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="rounded-lg border-border/60 text-muted-foreground"
                >
	                  <Link href={recruitingTrialsHref}>
	                    See all {recruitingCount} trials →
                  </Link>
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {recentTrials.map((trial) => (
                  <PublicTrialCard key={trial.nct_id} trial={trial} />
                ))}
              </div>
            </section>
          )}

          {trials.length === 0 && (
            <div className="mt-16 rounded-2xl border border-border/50 bg-white/90 p-8 text-center text-sm text-muted-foreground">
              No recruiting trials are available yet. Check back soon.
            </div>
          )}

          {/* ── CTA band ─────────────────────────────────── */}
          <section
            className="mt-16 flex flex-wrap items-center justify-between gap-6 rounded-2xl px-10 py-12"
            style={{ background: `${hex}07`, border: `1px solid ${hex}18` }}
          >
            <div>
              <h2
                className="mb-2 font-display font-normal text-foreground tracking-[-0.015em]"
                style={{ fontSize: 28 }}
              >
                Ready to see if you qualify?
              </h2>
              <p className="text-[15px] text-muted-foreground">
                Most patients find their first match in under two minutes.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Button
                asChild
                variant="brand"
                className="px-6 shadow-[0_4px_18px_rgba(45,155,112,0.26)]"
              >
	                <Link href={recruitingTrialsHref}>Start matching</Link>
              </Button>
              <Link
	                href={recruitingTrialsHref}
                className="text-[14px] font-medium transition-opacity hover:opacity-75"
                style={{ color: hex }}
              >
                Browse trials →
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

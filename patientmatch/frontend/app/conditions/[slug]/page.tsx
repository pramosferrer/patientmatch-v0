export const dynamic = 'force-dynamic';

import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getConditionCatalog } from '@/shared/conditions.catalog';
import { CONDITION_DETAILS } from '@/shared/conditions';
import { toConditionSlug } from '@/shared/conditions-normalize';
import { getServerSupabase } from '@/lib/supabaseServer';
import { ConditionIcon, getConditionStyles } from '@/components/icons/ConditionIcon';
import JsonLd from '@/components/trials/JsonLd';
import PublicTrialCard, { type PublicTrial } from '@/components/trials/PublicTrialCard';
import MicroScreener from '@/components/marketing/MicroScreener';
import { Button } from '@/components/ui/button';

const FALLBACK_TRIAL_TYPES = ['Medication studies', 'Lifestyle programs', 'Support tools'];
const FALLBACK_INTERVENTIONS = ['Therapeutic treatments', 'Monitoring tools', 'Care programs'];

function getConditionDetail(slug: string, label: string) {
  const known = CONDITION_DETAILS[slug];
  const description = known?.description
    ? known.description
    : `Clinical trials for ${label} and related care.`;

  return {
    description,
    trialTypes: known?.trialTypes?.length ? known.trialTypes : FALLBACK_TRIAL_TYPES,
    interventions: known?.interventions?.length ? known.interventions : FALLBACK_INTERVENTIONS
  };
}

function buildConditionFilters(label: string, slug: string, synonyms?: string[]) {
  const values = new Set<string>();
  if (slug) values.add(slug);
  if (label) values.add(label);
  (synonyms ?? []).forEach((synonym) => {
    const trimmed = synonym.trim();
    if (trimmed) values.add(trimmed);
  });
  return Array.from(values);
}

function formatCountLabel(count: number) {
  if (count <= 0) return 'No recruiting trials yet';
  return `${count} recruiting trial${count === 1 ? '' : 's'}`;
}

type ConditionTrial = PublicTrial & {
  last_update_date?: string | null;
};

export async function generateStaticParams() {
  const catalog = await getConditionCatalog();
  return catalog.all.slice(0, 50).map((condition) => ({ slug: condition.slug }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = toConditionSlug(rawSlug);
  if (!slug || slug === 'other') {
    return {
      title: 'Condition not found',
      description: 'Explore recruiting clinical trials by condition.'
    };
  }

  const catalog = await getConditionCatalog();
  const condition = catalog.all.find((item) => item.slug === slug);
  if (!condition) {
    return {
      title: 'Condition not found',
      description: 'Explore recruiting clinical trials by condition.'
    };
  }

  const detail = getConditionDetail(slug, condition.label);
  return {
    title: `${condition.label} clinical trials`,
    description: detail.description
  };
}

export default async function ConditionPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = toConditionSlug(rawSlug);
  if (!slug || slug === 'other') notFound();

  const catalog = await getConditionCatalog();
  const condition = catalog.all.find((item) => item.slug === slug);
  if (!condition) notFound();

  const detail = getConditionDetail(slug, condition.label);
  const countLabel = formatCountLabel(condition.count);
  const styles = getConditionStyles(condition.slug);

  const supabase = getServerSupabase();
  const filterValues = buildConditionFilters(condition.label, slug, condition.synonyms);
  let query = supabase
    .from('trials')
    .select('nct_id, title, status_bucket, conditions, quality_score, last_update_date')
    .eq('is_publishable', true);

  if (filterValues.length > 0) {
    query = query.overlaps('conditions', filterValues);
  }

  const { data: trialsData } = await query
    .eq('status_bucket', 'recruiting')
    .order('last_update_date', { ascending: false, nullsFirst: false })
    .order('quality_score', { ascending: false, nullsFirst: false })
    .limit(80);

  const trials = (trialsData ?? []) as ConditionTrial[];
  const recentTrials = trials.slice(0, Math.min(6, trials.length));

  return (
    <>
      <JsonLd trials={trials} />
      <main className="pb-16 pt-12">
        <section className="pm-container">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-3xl ${styles.bg} ${styles.text} ring-1 ${styles.ring}`}
                  aria-hidden
                >
                  <ConditionIcon slug={condition.slug} className="h-6 w-6" />
                </span>
                <span className="text-sm font-medium text-muted-foreground">Condition hub</span>
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
                  {condition.label} clinical trials
                </h1>
                <p className="text-base text-muted-foreground">{detail.description}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center rounded-full border border-border bg-warm-cream/80 px-3 py-1 font-medium text-foreground">
                  {countLabel}
                </span>
                <Link
                  href={`/trials?condition=${condition.slug}`}
                  className="inline-flex items-center gap-1 text-primary underline-offset-4 transition hover:text-primary/80 hover:underline"
                >
                  Browse all trials
                  <span aria-hidden>→</span>
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-white/90 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Common trial types
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {detail.trialTypes.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span aria-hidden className="mt-1 text-primary">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-border bg-white/90 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Example interventions
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {detail.interventions.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span aria-hidden className="mt-1 text-primary">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <MicroScreener
              conditionSlug={condition.slug}
              conditionLabel={condition.label}
            />
          </div>
        </section>

        <section className="pm-container mt-12">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-foreground">
              Recent opportunities
            </h2>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/trials?condition=${condition.slug}`}>View all</Link>
            </Button>
          </div>

          {recentTrials.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {recentTrials.map((trial) => (
                <PublicTrialCard key={trial.nct_id} trial={trial} />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-hairline bg-white/90 p-8 text-center text-sm text-muted-foreground">
              No recruiting trials are available yet. Check back soon.
            </div>
          )}
        </section>

        <section className="pm-container mt-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-foreground">
              All {condition.label} trials
            </h2>
            <span className="text-sm text-muted-foreground">
              Showing {trials.length} of {condition.count} recruiting trials
            </span>
          </div>

          {trials.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {trials.map((trial) => (
                <PublicTrialCard key={`${trial.nct_id}-full`} trial={trial} />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-hairline bg-white/90 p-8 text-center text-sm text-muted-foreground">
              We do not have recruiting trials in this category yet.
            </div>
          )}
        </section>
      </main>
    </>
  );
}

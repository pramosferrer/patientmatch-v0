/** Presentation-only wrapper that reuses TrialCard logic in a row layout. */
'use client';

import { useCallback, useEffect, useMemo, useState, useId } from 'react';
import Link from 'next/link';
import { Bookmark, BookmarkCheck, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ScoreBreakdownSheet from './ScoreBreakdownSheet';
import { Chip } from './Chips';
import {
  buildReasonCopy,
  deriveNearestSite,
  FIT_BADGE_CLASSES,
  FIT_DISPLAY_LABELS,
  VISIT_MODEL_COPY,
  getComponentEntries,
  getPhaseBadgeLabel,
  type TrialCardProps,
  type FitLabel,
} from './TrialCard';
import { screenerHref } from '@/lib/urls';
import { trialAnalytics } from '@/lib/analytics';
import { useSavedTrials } from '@/lib/compare/state';
import { toConditionLabel, toConditionSlug } from '@/shared/conditions-normalize';
import { getConditionColors } from '@/shared/colors';
import { cn } from '@/lib/utils';

type Mode = 'match' | 'browse';

export type TrialRowAdapterProps = TrialCardProps & {
  mode?: Mode;
  rowIndex?: number;
  showCompareSelect?: boolean;
};

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

type ConditionDisplay = {
  label: string | null;
  extraCount: number;
};

const KNOWN_CONDITION_KEYS = ['conditions', 'condition_names', 'original_conditions'] as const;

// Derive a plain-English condition label using the requested fallback order.

function extractConditionLabel(trial: TrialCardProps): ConditionDisplay {
  const labels: string[] = [];
  const seen = new Set<string>();

  const addCandidate = (raw?: string | null) => {
    if (!raw) return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const slug = toConditionSlug(trimmed);
    const key = slug && slug !== 'other' ? slug : trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const label =
      slug && slug !== 'other'
        ? toConditionLabel(slug)
        : toConditionLabel(trimmed.replace(/\s+/g, '_'));
    labels.push(label ?? titleCase(trimmed));
  };

  addCandidate((trial as Record<string, unknown>).normalized_condition as string | undefined);

  KNOWN_CONDITION_KEYS.forEach((key) => {
    const value = (trial as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === 'string') addCandidate(item);
      });
    }
  });

  addCandidate(typeof trial.condition === 'string' ? trial.condition : null);

  if (Array.isArray(trial.condition_slugs)) {
    trial.condition_slugs.forEach((slug) => addCandidate(slug));
  }

  const keywords = (trial as Record<string, unknown>).keywords;
  if (Array.isArray(keywords)) {
    keywords.some((keyword) => {
      if (typeof keyword !== 'string') return false;
      const slug = toConditionSlug(keyword);
      if (slug && slug !== 'other') {
        addCandidate(slug);
        return true;
      }
      return false;
    });
  }

  if (Array.isArray(trial.original_conditions)) {
    trial.original_conditions.forEach((condition) => addCandidate(condition));
  }

  const label = labels[0] ?? null;
  // Guard: skip eyebrow entirely when no condition could be derived.
  const extraCount = label ? Math.max(0, labels.length - 1) : 0;
  return { label, extraCount };
}

function coerceConfidence(props: TrialCardProps): number | undefined {
  const value = props.score0to100 ?? props.confidence;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function extractInterventionClass(trial: TrialCardProps): string | null {
  const rawCandidates = [
    (trial as Record<string, unknown>).intervention_classes,
    (trial as Record<string, unknown>).interventions,
    (trial as Record<string, unknown>).intervention_names,
    (trial as Record<string, unknown>).intervention_keywords,
  ];

  for (const source of rawCandidates) {
    if (!source) continue;
    if (typeof source === 'string') {
      const trimmed = source.trim();
      if (trimmed) return trimmed;
    }
    if (Array.isArray(source)) {
      for (const item of source) {
        if (typeof item === 'string') {
          const trimmed = item.trim();
          if (trimmed) return trimmed;
        }
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          const name = record.class ?? record.type ?? record.name ?? record.label;
          if (typeof name === 'string') {
            const trimmed = name.trim();
            if (trimmed) return trimmed;
          }
        }
      }
    }
  }

  return null;
}

export default function TrialRowAdapter({
  mode = 'match',
  rowIndex,
  ...props
}: TrialRowAdapterProps) {
  const breakdown = props.components ?? null;
  const visitModelValue = props.visitModel ?? props.visit_model ?? null;
  const visitModelLabel = visitModelValue ? VISIT_MODEL_COPY[visitModelValue] : null;
  const phaseLabel = getPhaseBadgeLabel(props.phase);
  const titleId = useId();

  const { saveTrial, removeTrial, isSaved, toggleCompareSelection, selectedForCompare, canSelectMore } = useSavedTrials();
  const saved = isSaved(props.nct_id);
  const selected = selectedForCompare.includes(props.nct_id);



  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const { roundedDistance, cityState, distanceChip } = useMemo(
    () => deriveNearestSite(props, breakdown),
    [props, breakdown],
  );

  const { cardReasons, sheetReasons } = useMemo(
    () => buildReasonCopy(props, breakdown, roundedDistance, visitModelLabel, cityState),
    [props, breakdown, roundedDistance, visitModelLabel, cityState],
  );

  const componentEntries = useMemo(() => getComponentEntries(breakdown), [breakdown]);

  const confidenceScore = coerceConfidence(props);
  const roundedConfidence =
    typeof confidenceScore === 'number' && Number.isFinite(confidenceScore)
      ? Math.round(confidenceScore)
      : undefined;

  const derivedLabel: FitLabel | undefined =
    props.label ??
    (typeof roundedConfidence === 'number'
      ? roundedConfidence >= 70
        ? 'Likely'
        : roundedConfidence >= 40
          ? 'Possible'
          : 'Unlikely'
      : undefined);

  const displayFitLabel = derivedLabel ? FIT_DISPLAY_LABELS[derivedLabel] : undefined;

  const conditionInfo = useMemo(() => extractConditionLabel(props), [props]);
  const conditionLabel = conditionInfo.label;
  const additionalConditionsLabel =
    conditionInfo.extraCount > 0 ? `+${conditionInfo.extraCount} more` : null;

  const primaryConditionSlug = useMemo(() => {
    if (Array.isArray(props.condition_slugs) && props.condition_slugs.length > 0) {
      return props.condition_slugs[0];
    }
    if (conditionLabel) {
      return toConditionSlug(conditionLabel) ?? undefined;
    }
    return undefined;
  }, [conditionLabel, props.condition_slugs]);

  const conditionAccentClass = useMemo(() => {
    if (!primaryConditionSlug) return 'bg-slate-400';
    const colors = getConditionColors(primaryConditionSlug);
    const tone = colors?.text ?? '';
    return typeof tone === 'string' && tone.startsWith('text-')
      ? tone.replace('text-', 'bg-')
      : 'bg-slate-400';
  }, [primaryConditionSlug]);

  const rawProps = props as Record<string, unknown>;
  const primaryCity = typeof rawProps.primary_city === 'string' ? rawProps.primary_city.trim() : null;
  const primaryState = typeof rawProps.primary_state === 'string' ? rawProps.primary_state.trim() : null;
  const fallbackCountry = Array.isArray(props.location_countries)
    ? props.location_countries.find((value): value is string => typeof value === 'string' && value.trim().length > 0) ?? null
    : typeof rawProps.country === 'string'
      ? rawProps.country
      : null;

  const locationLabel = useMemo(() => {
    if (cityState) return cityState;
    if (primaryCity && primaryState) return `${primaryCity}, ${primaryState}`;
    if (primaryCity) return primaryCity;
    if (primaryState) return primaryState;
    return fallbackCountry;
  }, [cityState, fallbackCountry, primaryCity, primaryState]);

  const siteCountLabel = useMemo(() => {
    if (typeof props.site_count !== 'number' || !Number.isFinite(props.site_count)) return null;
    if (props.site_count <= 0) return null;
    if (props.site_count === 1) return '1 site';
    return `+${props.site_count - 1} sites`;
  }, [props.site_count]);

  const distanceSummary = useMemo(() => {
    if (mode !== 'match') return null;
    if (roundedDistance != null) {
      return `~${roundedDistance} mi`;
    }
    return null;
  }, [mode, roundedDistance]);

  const primaryReasons = useMemo(
    () =>
      mode === 'match'
        ? cardReasons
          .filter((reason): reason is string => typeof reason === 'string' && reason.trim().length > 0)
          .slice(0, 2)
        : [],
    [cardReasons, mode],
  );

  const reasonsSummary = useMemo(() => {
    if (primaryReasons.length === 0) return null;
    return primaryReasons.join(' · ');
  }, [primaryReasons]);

  const phaseDisplay = phaseLabel && phaseLabel !== 'Phase NA' ? phaseLabel : null;

  useEffect(() => {
    trialAnalytics.impression(props.nct_id, props.condition_slugs?.[0], props.phase || undefined);
  }, [props.nct_id, props.condition_slugs, props.phase]);

  useEffect(() => {
    if (copyStatus === 'idle') return;
    const timer = window.setTimeout(() => setCopyStatus('idle'), 3000);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  const handleSaveToggle = useCallback(() => {
    if (saved) {
      removeTrial(props.nct_id);
      trialAnalytics.removeTrial(props.nct_id);
      return;
    }

    saveTrial({
      nct_id: props.nct_id,
      title: props.title,
      phase: props.phase,
      site_count: props.site_count,
      min_age_years: props.min_age_years,
      max_age_years: props.max_age_years,
      location_countries: props.location_countries,
      sponsor: props.sponsor,
    });
    trialAnalytics.saveTrial(props.nct_id);
  }, [
    saveTrial,
    props.location_countries,
    props.max_age_years,
    props.min_age_years,
    props.nct_id,
    props.phase,
    props.site_count,
    props.sponsor,
    props.title,
    removeTrial,
    saved,
  ]);

  const getSharableUrl = useCallback(() => {
    if (props.trial_url) return props.trial_url;
    if (props.ctgov_url) return props.ctgov_url;
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/trial/${props.nct_id}`;
    }
    return `https://clinicaltrials.gov/study/${props.nct_id}`;
  }, [props.ctgov_url, props.nct_id, props.trial_url]);

  const handleCopyLink = useCallback(async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(getSharableUrl());
      setCopyStatus('success');
    } catch (error) {
      console.error('Copy link failed', error);
      setCopyStatus('error');
    }
  }, [getSharableUrl]);

  const handleShareWithDoctor = useCallback(() => {
    if (typeof window === 'undefined') return;
    const url = getSharableUrl();
    const subject = encodeURIComponent(`Clinical trial to consider: ${props.title}`);
    const bodyLines = [
      'Hi there,',
      '',
      `Could we discuss this clinical trial? ${url}`,
      '',
      visitModelLabel ? `Visit option: ${visitModelLabel}` : '',
      distanceChip ? `Nearest site: ${distanceChip}` : '',
      '',
      'Thanks!',
    ].filter(Boolean);
    const body = encodeURIComponent(bodyLines.join('\n'));
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank', 'noopener,noreferrer');
  }, [distanceChip, getSharableUrl, props.title, visitModelLabel]);

  const handleDetailsChange = useCallback((nextOpen: boolean) => {
    setDetailsOpen(nextOpen);
    if (!nextOpen) {
      setCopyStatus('idle');
    }
  }, []);

  const handlePrimaryCta = useCallback(() => {
    trialAnalytics.ctaClick(props.nct_id);
    if (props.onOpenScreener) {
      const { onOpenScreener: _omit, ...payload } = props;
      props.onOpenScreener(payload);
    }
  }, [props]);

  const SaveToggleButton = ({ className }: { className?: string }) => (
    <button
      type="button"
      onClick={handleSaveToggle}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        saved ? 'bg-foreground text-background hover:bg-foreground/90' : 'bg-white',
        className,
      )}
      aria-label={
        saved ? `Remove ${props.title} from saved trials` : `Save ${props.title} to compare later`
      }
      disabled={false}
    >
      {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
    </button>
  );

  const PrimaryActionButton = ({ className }: { className?: string }) =>
    props.onOpenScreener ? (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={cn(
          'rounded-full border-hairline bg-white px-4 py-1.5 text-sm font-semibold text-foreground transition hover:bg-foreground/5',
          className,
        )}
        onClick={handlePrimaryCta}
        aria-label={`Check eligibility for ${props.title}`}
      >
        Check eligibility
      </Button>
    ) : (
      <Button
        asChild
        size="sm"
        variant="outline"
        className={cn(
          'rounded-full border-hairline bg-white px-4 py-1.5 text-sm font-semibold text-foreground transition hover:bg-foreground/5',
          className,
        )}
      >
        <Link
          href={screenerHref({ nct_id: props.nct_id })}
          prefetch
          aria-label={`Check eligibility for ${props.title}`}
          onClick={() => trialAnalytics.ctaClick(props.nct_id)}
        >
          Check eligibility
        </Link>
      </Button>
    );

  const DetailsButton = ({ className }: { className?: string }) => (
    <button
      type="button"
      onClick={() => setDetailsOpen(true)}
      className={cn(
        'text-xs font-semibold text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
      aria-label={`View details for ${props.title}`}
      aria-expanded={detailsOpen}
    >
      Details
    </button>
  );

  return (
    <article
      className="border-b border-hairline px-4 py-4 transition-colors sm:px-6 sm:py-5"
      aria-labelledby={titleId}
      data-row-index={rowIndex}
    >
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:gap-8">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {conditionLabel && (
              <Chip
                label={conditionLabel}
                accentColor={conditionAccentClass}
                className="text-[12px] font-semibold text-foreground"
              />
            )}
            {additionalConditionsLabel && (
              <span className="rounded-full border border-hairline bg-white px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                {additionalConditionsLabel}
              </span>
            )}
            {phaseDisplay && (
              <span className="rounded-full border border-hairline bg-white px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                {phaseDisplay}
              </span>
            )}
            {mode === 'match' && derivedLabel && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                  FIT_BADGE_CLASSES[derivedLabel],
                )}
              >
                {displayFitLabel ?? derivedLabel}
              </span>
            )}
          </div>

          <div className="space-y-1">
            <h3
              id={titleId}
              className="text-[18px] font-semibold leading-snug text-foreground line-clamp-2 md:text-[19px]"
            >
              {props.title}
            </h3>
            {props.sponsor && (
              <p className="text-[12px] text-muted-foreground">
                Sponsored by {props.sponsor}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              Recruiting
            </span>
            {visitModelLabel && (
              <span className="inline-flex items-center gap-1">{visitModelLabel}</span>
            )}
            {locationLabel && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 text-muted-foreground/80" aria-hidden />
                {locationLabel}
              </span>
            )}
            {siteCountLabel && <span>{siteCountLabel}</span>}
            {distanceSummary && <span>{distanceSummary}</span>}
          </div>

          {mode === 'match' && reasonsSummary && (
            <p className="text-[12px] text-muted-foreground">
              <span className="font-semibold text-foreground/80">Why this fits:</span> {reasonsSummary}
            </p>
          )}
        </div>

        <div className="hidden min-w-[220px] flex-col items-end gap-3 md:flex">
          {props.showCompareSelect && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="mr-2 rounded border-gray-300 text-pm-primary focus:ring-pm-primary"
                  checked={selected}
                  onChange={() => toggleCompareSelection(props.nct_id)}
                  disabled={!selected && !canSelectMore}
                />
                Compare
              </label>
            </div>
          )}
          <SaveToggleButton />
          <div className="flex items-center gap-2">
            <PrimaryActionButton />
            <DetailsButton />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 md:hidden">
        <PrimaryActionButton className="w-full justify-center" />
        <div className="flex items-center justify-between gap-3">
          <DetailsButton />
          <SaveToggleButton />
        </div>
      </div>
      <ScoreBreakdownSheet
        open={detailsOpen}
        onOpenChange={handleDetailsChange}
        title={props.title}
        sponsor={props.sponsor ?? undefined}
        fitLabel={derivedLabel}
        confidence={roundedConfidence}
        distanceLabel={distanceSummary}
        cityState={locationLabel}
        visitModelLabel={visitModelLabel}
        reasons={sheetReasons}
        components={componentEntries}
        saved={saved}
        onToggleSave={handleSaveToggle}
        onCopyLink={handleCopyLink}
        onShareWithDoctor={handleShareWithDoctor}
        copyStatus={copyStatus}
      />
    </article>
  );
}

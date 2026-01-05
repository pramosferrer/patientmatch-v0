'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bookmark, BookmarkCheck, ChevronRight, Heart } from 'lucide-react';
import { screenerHref } from '@/lib/urls';
import { trialAnalytics } from '@/lib/analytics';
import { useShortlist } from '@/lib/compare/state';
import { formatAge, formatPhase } from '@/lib/trials/formatters';
import ScoreBreakdownSheet from './ScoreBreakdownSheet';
import { MagicLinkDialog } from '@/components/auth/MagicLinkDialog';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useSavedTrials } from '@/hooks/useSavedTrials';

export type ScoreComponent = {
  value?: number;
  reasons?: string[];
  distance_miles?: number | null;
};

export type ScoreComponents = {
  eligibility?: ScoreComponent;
  logistics?: ScoreComponent;
  priority?: ScoreComponent;
};

export type VisitModel = 'on_site' | 'hybrid' | 'remote' | null;
export type FitLabel = 'Likely' | 'Possible' | 'Unlikely';

type Props = {
  nct_id: string;
  title: string;
  summary?: string | null;
  phase?: string | null;
  status?: string | null;
  trial_url?: string;
  ctgov_url?: string;
  site_count?: number | null;
  location_countries?: string[] | null;
  sponsor?: string | null;
  condition_slugs?: string[] | null;
  condition?: string | null;
  original_conditions?: string[] | null;
  criteria_json?: any[] | null;
  visit_model?: VisitModel;
  travel_stipend?: boolean | null;
  accessibility_tags?: string[] | null;
  compensation?: string | null;
  reasons?: string[];
  score?: number;
  score0to100?: number;
  confidence?: number;
  label?: FitLabel;
  details?: Array<{ factor: string; impact: number; reason: string }>;
  showExplainScore?: boolean;
  distanceMiles?: number | null;
  distance_miles?: number | null;
  isConditionUncertain?: boolean;
  visitModel?: VisitModel;
  hasComp?: boolean;
  hasTravel?: boolean;
  visitsCount?: number | null;
  cadenceDays?: number | null;
  min_age_years?: number | null;
  max_age_years?: number | null;
  gender?: string | null;
  locations?: any[] | null;
  nearest_site?: {
    city?: string | null;
    state?: string | null;
    lat?: number | null;
    lon?: number | null;
    distance_miles?: number | null;
    geocode_source?: string | null;
  } | null;
  created_at?: string | null;
  first_posted_date?: string | null;
  isCompact?: boolean;
  catalog?: any;
  components?: ScoreComponents;
};

export type TrialCardData = Props & {
  bucket?: FitLabel;
  proView?: boolean;
};

export type TrialCardProps = TrialCardData & {
  onOpenScreener?: (trial: TrialCardData) => void;
};

type NormalizedNearestSite = {
  city: string | null;
  state: string | null;
  lat: number | null;
  lon: number | null;
  distance_miles: number | null;
  geocode_source: string | null;
};

type ComponentKey = 'eligibility' | 'logistics' | 'priority';

export type ComponentDisplay = {
  key: ComponentKey;
  label: string;
  percent: number | null;
  reasons: string[];
};

export const VISIT_MODEL_COPY: Record<Exclude<VisitModel, null>, string> = {
  on_site: 'In-person',
  hybrid: 'Hybrid',
  remote: 'Remote',
};

export const FIT_BADGE_CLASSES: Record<FitLabel, string> = {
  Likely: 'border-emerald-400/60 text-emerald-700',
  Possible: 'border-amber-400/70 text-amber-700',
  Unlikely: 'border-slate-300 text-slate-600',
};

export const FIT_DISPLAY_LABELS: Record<FitLabel, string> = {
  Likely: 'Likely fit',
  Possible: 'Possible fit',
  Unlikely: 'Unclear fit',
};

export const SCORE_COMPONENT_LABELS: Record<ComponentKey, string> = {
  eligibility: 'Eligibility',
  logistics: 'Logistics',
  priority: 'Priority',
};

export const COMPONENT_KEYS: ComponentKey[] = ['eligibility', 'logistics', 'priority'];

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toPercent(value?: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const scaled = value > 1 ? value : value * 100;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

export function getPhaseBadgeLabel(phase?: string | null): string | null {
  if (!phase) return null;
  const formatted = formatPhase(phase || undefined);
  if (formatted && formatted !== 'NA') return formatted;
  const normalized = phase.trim().toUpperCase();
  if (normalized === 'NA' || normalized === 'N/A') return null;
  return `Phase ${phase}`;
}

export function deriveNearestSite(
  props: TrialCardProps,
  breakdown: ScoreComponents | null,
): {
  nearestSite: NormalizedNearestSite | null;
  distanceMiles: number | null;
  roundedDistance: number | null;
  cityState: string | null;
  distanceChip: string | null;
} {
  const componentDistance = cleanNumber(breakdown?.logistics?.distance_miles ?? null);
  const legacyDistance = cleanNumber(props.distanceMiles ?? props.distance_miles ?? null);
  const rawNearestSite =
    props.nearest_site && typeof props.nearest_site === 'object'
      ? (props.nearest_site as Record<string, unknown>)
      : null;

  const normalizedNearestSite: NormalizedNearestSite | null = rawNearestSite
    ? {
      city: cleanString(rawNearestSite.city),
      state: cleanString(rawNearestSite.state),
      lat: cleanNumber(rawNearestSite.lat),
      lon: cleanNumber(rawNearestSite.lon),
      distance_miles: cleanNumber(rawNearestSite.distance_miles),
      geocode_source: cleanString(rawNearestSite.geocode_source),
    }
    : null;

  const legacyProps = props as Record<string, unknown>;
  const legacyCity = cleanString(legacyProps.nearest_site_city);
  const legacyState = cleanString(legacyProps.nearest_site_state);

  const fallbackNearestSite =
    normalizedNearestSite == null &&
      (legacyCity || legacyState || typeof legacyDistance === 'number' || typeof componentDistance === 'number')
      ? {
        city: legacyCity,
        state: legacyState,
        lat: null,
        lon: null,
        distance_miles: cleanNumber(legacyDistance ?? componentDistance),
        geocode_source: null,
      }
      : null;

  const nearestSite = normalizedNearestSite ?? fallbackNearestSite;
  const distanceCandidate =
    cleanNumber(nearestSite?.distance_miles ?? null) ??
    (typeof legacyDistance === 'number' ? legacyDistance : null) ??
    componentDistance ??
    null;
  const roundedDistance = typeof distanceCandidate === 'number' ? Math.round(distanceCandidate) : null;

  const locationParts: string[] = [];
  if (nearestSite?.city) locationParts.push(nearestSite.city);
  if (nearestSite?.state) locationParts.push(nearestSite.state);
  const cityState = locationParts.length > 0 ? locationParts.join(', ') : null;

  let distanceChip: string | null = null;
  if (roundedDistance != null && cityState) {
    distanceChip = `~${roundedDistance} mi (${cityState})`;
  } else if (roundedDistance != null) {
    distanceChip = `~${roundedDistance} mi`;
  } else if (cityState) {
    distanceChip = cityState;
  }

  return {
    nearestSite: nearestSite
      ? {
        city: nearestSite.city ?? null,
        state: nearestSite.state ?? null,
        lat: cleanNumber(nearestSite.lat),
        lon: cleanNumber(nearestSite.lon),
        distance_miles: cleanNumber(distanceCandidate),
        geocode_source: nearestSite.geocode_source ?? null,
      }
      : null,
    distanceMiles: typeof distanceCandidate === 'number' ? distanceCandidate : null,
    roundedDistance,
    cityState,
    distanceChip,
  };
}

function normalizeReason(reason?: string | null): string | null {
  if (typeof reason !== 'string') return null;
  const trimmed = reason.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\s+/g, ' ');
}

export function buildReasonCopy(
  props: TrialCardProps,
  breakdown: ScoreComponents | null,
  roundedDistance: number | null,
  visitModelLabel: string | null,
  cityState: string | null,
): { cardReasons: string[]; sheetReasons: string[] } {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const pushCandidate = (value: unknown) => {
    if (typeof value !== 'string') return;
    const normalized = normalizeReason(value);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(normalized);
  };

  if (Array.isArray(props.reasons)) {
    props.reasons.forEach((reason) => pushCandidate(reason));
  }

  if (breakdown) {
    COMPONENT_KEYS.forEach((key) => {
      const group = breakdown[key]?.reasons;
      if (Array.isArray(group)) {
        group.forEach((reason) => pushCandidate(reason));
      }
    });
  }

  candidates.sort((a, b) => a.length - b.length);

  const cardReasons: string[] = [];
  const sheetReasons: string[] = [];

  for (const reason of candidates) {
    if (cardReasons.length < 4) cardReasons.push(reason);
    if (sheetReasons.length < 4) sheetReasons.push(reason);
    if (cardReasons.length >= 4 && sheetReasons.length >= 4) break;
  }

  const addFallback = (value: string) => {
    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      if (cardReasons.length < 4) cardReasons.push(value);
      if (sheetReasons.length < 4) sheetReasons.push(value);
    }
  };

  if (roundedDistance != null && cityState) {
    addFallback(`~${roundedDistance} mi drive (${cityState})`);
  } else if (roundedDistance != null) {
    addFallback(`~${roundedDistance} mi drive`);
  }

  const ageLabel = formatAge(props.min_age_years ?? undefined, props.max_age_years ?? undefined);
  if (ageLabel && ageLabel !== 'All ages') {
    addFallback('Age matches this study’s range');
  }

  addFallback('Diagnosis matches');

  if (visitModelLabel === 'Remote' || visitModelLabel === 'Hybrid') {
    addFallback('Remote / hybrid option available');
  }

  const gender = typeof props.gender === 'string' ? props.gender.trim() : '';
  if (gender && !/^all\b/i.test(gender)) {
    addFallback(`Open to ${gender.toLowerCase()}`);
  }

  addFallback('Meds you listed don’t conflict');

  if (cardReasons.length === 0) {
    cardReasons.push('Diagnosis matches');
  }
  if (sheetReasons.length === 0) {
    sheetReasons.push('Diagnosis matches');
  }

  return {
    cardReasons: cardReasons.slice(0, 4),
    sheetReasons: sheetReasons.slice(0, 4),
  };
}

export function getComponentEntries(breakdown: ScoreComponents | null): ComponentDisplay[] {
  const entries: ComponentDisplay[] = [];
  COMPONENT_KEYS.forEach((key) => {
    const data = breakdown?.[key];
    if (!data) return;
    const reasons = Array.isArray(data.reasons)
      ? data.reasons
        .map((reason) => normalizeReason(reason))
        .filter((reason): reason is string => Boolean(reason))
      : [];
    entries.push({
      key,
      label: SCORE_COMPONENT_LABELS[key],
      percent: toPercent(data.value),
      reasons,
    });
  });
  return entries;
}

function isRecentlyPosted(created_at?: string | null, first_posted_date?: string | null): boolean {
  const source = created_at || first_posted_date;
  if (!source) return false;
  const trialDate = new Date(source);
  if (Number.isNaN(trialDate.getTime())) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  return trialDate >= cutoff;
}

export default function TrialCard(props: TrialCardProps) {
  const breakdown = props.components ?? null;
  const visitModelValue: VisitModel = props.visitModel ?? props.visit_model ?? null;
  const visitModelLabel = visitModelValue ? VISIT_MODEL_COPY[visitModelValue] : null;
  const phaseLabel = getPhaseBadgeLabel(props.phase);
  const proViewEnabled = Boolean(props.proView);

  const { roundedDistance, cityState, distanceChip } = deriveNearestSite(props, breakdown);
  const { cardReasons, sheetReasons } = buildReasonCopy(props, breakdown, roundedDistance, visitModelLabel, cityState);

  const componentEntries: ComponentDisplay[] = useMemo(
    () => getComponentEntries(breakdown),
    [breakdown],
  );

  const numericSiteCount = typeof props.site_count === 'number' ? props.site_count : Number(props.site_count ?? NaN);
  const additionalSites =
    Number.isFinite(numericSiteCount) && numericSiteCount > 1 ? `+${Math.max(0, Math.round(numericSiteCount) - 1)} sites` : null;

  const metaParts = [
    distanceChip || null,
    additionalSites,
    visitModelLabel || null,
    phaseLabel || null,
  ].filter((part): part is string => Boolean(part));

  const normalizedStatus = typeof props.status === 'string' ? props.status.trim().replace(/\s+/g, ' ') : '';
  const formattedStatus =
    normalizedStatus && normalizedStatus.length > 0
      ? normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1)
      : '';
  const statusIndicators = Array.from(
    new Set(
      [
        formattedStatus,
        visitModelValue === 'remote' ? 'Telehealth' : visitModelValue === 'hybrid' ? 'Hybrid visits' : '',
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  const confidenceScore =
    typeof props.confidence === 'number'
      ? props.confidence
      : typeof props.score0to100 === 'number'
        ? props.score0to100
        : undefined;
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

  const { addToShortlist, removeFromShortlist, isInShortlist, canAddMore } = useShortlist();
  const { user } = useSupabaseAuth();
  const { isSaved: isTrialFavorited, saveTrial: rememberTrial, removeTrial: forgetTrial } = useSavedTrials();
  const favorited = isTrialFavorited(props.nct_id);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const saved = isInShortlist(props.nct_id);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const isNew = useMemo(
    () => isRecentlyPosted(props.created_at, props.first_posted_date),
    [props.created_at, props.first_posted_date],
  );

  useEffect(() => {
    trialAnalytics.impression(props.nct_id, props.condition_slugs?.[0], props.phase || undefined);
  }, [props.nct_id, props.condition_slugs, props.phase]);

  useEffect(() => {
    if (copyStatus === 'idle') return;
    const timer = setTimeout(() => setCopyStatus('idle'), 3000);
    return () => clearTimeout(timer);
  }, [copyStatus]);

  const handleFavoriteToggle = useCallback(async () => {
    if (favoriteBusy) {
      return;
    }

    if (!user) {
      setShowMagicLink(true);
      return;
    }

    const shouldSave = !favorited;
    setFavoriteBusy(true);
    setFavoriteError(null);

    const applyOptimistic = shouldSave ? rememberTrial : forgetTrial;
    const rollback = shouldSave ? () => forgetTrial(props.nct_id) : () => rememberTrial(props.nct_id);

    applyOptimistic(props.nct_id);

    try {
      const response = await fetch('/api/user/saved-trials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nct_id: props.nct_id,
          action: shouldSave ? 'save' : 'remove',
        }),
      });

      if (!response.ok) {
        rollback();
        setFavoriteError('We could not update your saved trials. Please try again.');
      }
    } catch {
      rollback();
      setFavoriteError('We could not update your saved trials. Please try again.');
    } finally {
      setFavoriteBusy(false);
    }
  }, [favoriteBusy, favorited, forgetTrial, props.nct_id, rememberTrial, user]);

  const handleSaveToggle = useCallback(() => {
    if (saved) {
      removeFromShortlist(props.nct_id);
      trialAnalytics.removeTrial(props.nct_id);
      return;
    }

    const success = addToShortlist({
      nct_id: props.nct_id,
      title: props.title,
      phase: props.phase,
      site_count: props.site_count,
      min_age_years: props.min_age_years,
      max_age_years: props.max_age_years,
      location_countries: props.location_countries,
      sponsor: props.sponsor,
    });

    if (success) {
      trialAnalytics.saveTrial(props.nct_id);
    } else {
      trialAnalytics.shortlistLimitReached(props.nct_id);
    }
  }, [
    addToShortlist,
    props.location_countries,
    props.max_age_years,
    props.min_age_years,
    props.nct_id,
    props.phase,
    props.site_count,
    props.sponsor,
    props.title,
    removeFromShortlist,
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

  const handleDetailsChange = useCallback(
    (nextOpen: boolean) => {
      setDetailsOpen(nextOpen);
      if (!nextOpen) {
        setCopyStatus('idle');
      }
    },
    [setDetailsOpen],
  );

  const handlePrimaryCta = useCallback(() => {
    trialAnalytics.ctaClick(props.nct_id);
    if (props.onOpenScreener) {
      const { onOpenScreener: _omit, ...payload } = props;
      props.onOpenScreener(payload);
    }
  }, [props]);

  return (
    <>
      <Card className="flex h-full flex-col transition hover:border-primary/40 hover:shadow-[0_18px_48px_rgba(15,23,42,0.12)]">
        <CardContent className="flex h-full flex-col gap-4 p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <a
                href={getSharableUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                <h3 className="font-heading text-lg font-semibold text-foreground">{props.title}</h3>
              </a>
              {props.sponsor && (
                <p className="text-sm text-muted-foreground">Sponsored by {props.sponsor}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isNew && (
                <span className="rounded-md border border-amber-400/70 bg-white px-2 py-0.5 text-[12px] font-medium text-amber-700">
                  New
                </span>
              )}
              <button
                type="button"
                onClick={handleFavoriteToggle}
                className={`flex h-9 w-9 items-center justify-center rounded-md border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 ${favorited
                  ? 'border-rose-500/80 bg-rose-500/90 text-white hover:bg-rose-500'
                  : 'border-hairline text-muted-foreground hover:border-rose-400/70 hover:text-rose-500'
                  }`}
                aria-label={
                  favorited
                    ? `Remove ${props.title} from saved trials`
                    : `Save ${props.title} to your list`
                }
                disabled={favoriteBusy}
              >
                <Heart className={`h-4 w-4 ${favorited ? 'fill-current' : ''}`} />
              </button>
              <button
                type="button"
                onClick={handleSaveToggle}
                className={`flex h-9 w-9 items-center justify-center rounded-md border border-hairline transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 ${saved
                  ? 'border-primary/50 bg-primary text-primary-foreground hover:bg-[color-mix(in_oklab,var(--color-primary) 88%,#000 12%)]'
                  : 'text-muted-foreground hover:border-primary/40 hover:text-primary'
                  }`}
                aria-label={
                  saved
                    ? `Remove ${props.title} from saved trials`
                    : `Save ${props.title} to compare later`
                }
                disabled={!saved && !canAddMore}
              >
                {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {favoriteError && (
            <p className="text-xs text-red-600">{favoriteError}</p>
          )}

          <div className="border-t border-hairline" />

          <div className="space-y-2">
            {metaParts.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                {metaParts.map((part, index) => (
                  <React.Fragment key={`${part}-${index}`}>
                    <span>{part}</span>
                    {index < metaParts.length - 1 ? (
                      <span aria-hidden className="px-1 text-muted-foreground/50">·</span>
                    ) : null}
                  </React.Fragment>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {derivedLabel && (
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[12px] font-medium leading-tight ${FIT_BADGE_CLASSES[derivedLabel]}`}
                >
                  {displayFitLabel ?? derivedLabel}
                </span>
              )}
              {statusIndicators.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 text-[12px] font-medium text-muted-foreground">
                  {statusIndicators.map((label) => (
                    <span key={label} className="inline-flex items-center gap-1">
                      <span aria-hidden className="text-primary">●</span>
                      <span>{label}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-hairline" />

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground/80">Why this fits</span>{' '}
              <span className="text-foreground">{cardReasons.join(' • ')}</span>
            </p>
            {proViewEnabled && componentEntries.length > 0 && (
              <div className="flex flex-wrap gap-2 text-[12px]">
                {componentEntries.map((entry) => (
                  <span
                    key={entry.key}
                    className="inline-flex items-center gap-1 rounded-md border border-hairline bg-white px-2.5 py-1 text-muted-foreground"
                  >
                    <span className="font-semibold text-foreground/80">{entry.label[0]}</span>
                    <span>{entry.percent != null ? `${entry.percent}/100` : '—'}</span>
                    <span className="sr-only">{entry.label} score</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-hairline" />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {props.onOpenScreener ? (
              <Button
                type="button"
                variant="default"
                className="flex-1 justify-center"
                onClick={handlePrimaryCta}
                aria-label={`Check eligibility for ${props.title}`}
              >
                Check eligibility
              </Button>
            ) : (
              <Button
                asChild
                variant="default"
                className="flex-1 justify-center"
              >
                <Link
                  href={screenerHref({ nct_id: props.nct_id })}
                  prefetch={false}
                  aria-label={`Check eligibility for ${props.title}`}
                  onClick={() => trialAnalytics.ctaClick(props.nct_id)}
                >
                  Check eligibility
                </Link>
              </Button>
            )}
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 transition hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1"
              aria-label={`View details for ${props.title}`}
              aria-expanded={detailsOpen}
            >
              Details
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </CardContent>
      </Card>

      <ScoreBreakdownSheet
        open={detailsOpen}
        onOpenChange={handleDetailsChange}
        title={props.title}
        sponsor={props.sponsor ?? undefined}
        fitLabel={derivedLabel}
        confidence={roundedConfidence}
        distanceLabel={distanceChip}
        cityState={cityState}
        visitModelLabel={visitModelLabel}
        reasons={sheetReasons}
        components={componentEntries}
        saved={saved}
        onToggleSave={handleSaveToggle}
        onCopyLink={handleCopyLink}
        onShareWithDoctor={handleShareWithDoctor}
        copyStatus={copyStatus}
      />
      <MagicLinkDialog open={showMagicLink} onOpenChange={setShowMagicLink} />
    </>
  );
}

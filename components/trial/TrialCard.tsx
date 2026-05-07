'use client';

import React from 'react';
import Link from "next/link";
import { logEvent } from '@/lib/analytics';
import { screenerHref } from '@/lib/urls';
import { Brain, Wind, Flame, Stethoscope, FlaskConical, MapPin, UserRound, ActivitySquare } from "lucide-react";
import { getConditionIcon, labelFromSlug, FALLBACK_ICON, FALLBACK_CLASS } from "@/shared/conditionMeta";
import { guessConditionSlug } from "@/shared/guessCondition";
import {
  formatAge,
  formatLocation,
  formatPhase,
} from "@/lib/trials/formatters";

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
  original_conditions?: string[] | null;
  criteria_json?: any[] | null;
  min_age_years?: number | null;
  max_age_years?: number | null;
  gender?: string | null;
  locations?: any[] | null;
};

export default function TrialCard(p: Props) {
  const derived = guessConditionSlug(p.title, p.original_conditions);
  const mainSlug = p.condition_slugs?.[0] ?? derived ?? null;
  const { Icon, className } = getConditionIcon(mainSlug);
  const SafeIcon = Icon ?? FALLBACK_ICON;
  const safeClassName = className ?? FALLBACK_CLASS;

  const conditionLabel = labelFromSlug(mainSlug) || p.original_conditions?.[0] || "Clinical trial";
  const conditionLower = conditionLabel.toLowerCase();
  const ConditionGlyph = conditionLower.includes("alzheimer")
    ? Brain
    : conditionLower.includes("copd")
    ? Wind
    : conditionLower.includes("hidradenitis")
    ? Flame
    : Stethoscope;

  // Build pills
  const pills: Array<{ key: string; label: string; icon: React.ElementType }> = [];

  // Age
  pills.push({ key: "age", label: formatAge(p.min_age_years ?? undefined, p.max_age_years ?? undefined), icon: UserRound });

  // Phase (fallback to N/A)
  const phaseLabel = p.phase ? (formatPhase(p.phase || undefined) || `Phase ${p.phase}`) : "Phase N/A";
  pills.push({ key: "phase", label: phaseLabel, icon: FlaskConical });

  // Sites
  const siteCount = p.site_count ?? (p.locations?.length || 0);
  if (siteCount > 1) {
    pills.push({ key: "sites", label: `Multiple sites · ${siteCount}` as const, icon: MapPin });
  } else if (siteCount === 1) {
    pills.push({ key: "sites", label: "1 site", icon: MapPin });
  }

  return (
    <div className="group w-full rounded-xl border border-pm-border bg-white p-5 shadow-soft transition-all duration-200 hover:shadow-lg hover:border-pm-secondary/20">
      {/* Condition row with small icon */}
      <div className="flex items-start gap-2 text-sm text-pm-muted mb-3">
        {mainSlug ? (
          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${safeClassName}`} aria-hidden>
            <ConditionGlyph className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted" aria-hidden>
            <Stethoscope className="h-3.5 w-3.5" />
          </span>
        )}
        <span className="whitespace-normal break-words">{conditionLabel}</span>
      </div>

      {/* Title */}
              <h3 className="font-heading text-base md:text-lg font-semibold leading-tight line-clamp-2 text-pm-ink group-hover:text-pm-secondary transition-colors duration-200">
          {p.title}
        </h3>

      {/* Summary */}
      {p.summary && (
        <p className="mt-2 text-sm text-pm-muted line-clamp-2">{p.summary}</p>
      )}

      {/* Pills container */}
      <div className="mt-4 flex flex-wrap gap-2">
        {pills.map(({ key, label, icon: IconEl }) => (
          <span key={key} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-pm-body">
            <IconEl className="h-3.5 w-3.5" aria-hidden />
            <span>{label}</span>
          </span>
        ))}
      </div>

      {/* Sponsor */}
      {p.sponsor && (
        <div className="mt-4 text-sm text-pm-muted">
          <span className="font-medium text-pm-ink">Sponsor:</span> {p.sponsor}
        </div>
      )}

      {/* CTA */}
      <div className="mt-6">
        <Link
          href={screenerHref({ nct_id: p.nct_id })}
          prefetch
          aria-label={`Check eligibility for ${p.title}`}
          className="block"
          onClick={() => logEvent('trial_clicked', { nct_id: p.nct_id })}
        >
          <button
            className="rounded-xl bg-pm-primary hover:bg-pm-primaryHover text-white shadow-soft transition-all duration-200 hover:shadow-lg hover:scale-105 w-full py-3 font-medium"
          >
            Check eligibility
          </button>
        </Link>
      </div>
    </div>
  );
}



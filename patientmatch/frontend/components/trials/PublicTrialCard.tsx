"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Building2, MapPin, ExternalLink, Clock, FileText, Pill, Syringe, Brain, Cpu, ClipboardList, FlaskConical, Calendar } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactElement } from "react";
import type { MatchConfidenceResult } from "@/lib/matching/matchConfidence";
import QuickFacts from "@/components/trial/QuickFacts";

export type PublicTrial = {
  nct_id: string;
  title: string;
  display_title?: string | null;
  status_bucket?: string | null;
  conditions?: string[] | string | null;
  quality_score?: number | null;
  distance_miles?: number | null;
  sponsor?: string | null;
  phase?: string | null;
  site_count_us?: number | null;
  states_list?: string[] | null;
  min_age_years?: number | null;
  max_age_years?: number | null;
  nearest_site?: {
    city: string | null;
    state: string | null;
    facility_name: string | null;
    distance_miles: number | null;
    lat: number | null;
    lon: number | null;
    geocode_source: string | null;
  };
  matchResult?: MatchConfidenceResult;
  questionnaire_json?: any;
  intervention_mode_primary?: string | null;
  study_duration_days?: number | string | null;
  burden_score?: number | null;
  card_summary?: string | null;
};

type CardVariant = 'featured' | 'standard';

type StatusConfig = {
  textColor: string;
  bgColor: string;
  borderColor: string;
  stripColor: string;
  label: string;
  isUrgent: boolean;
};

function getStatusConfig(bucket?: string | null): StatusConfig {
  const normalized = typeof bucket === "string" ? bucket.trim().toLowerCase() : "";

  // Recruiting = amber/urgency (time-sensitive, action needed)
  if (normalized === "recruiting" || normalized === "active") {
    return {
      textColor: "text-urgency",
      bgColor: "bg-urgency-soft",
      borderColor: "border-urgency/30",
      stripColor: "bg-gradient-to-b from-urgency to-urgency-strong",
      label: "Enrolling now",
      isUrgent: true
    };
  }

  // Opening soon = caution yellow (anticipation)
  if (normalized === "not_yet_recruiting") {
    return {
      textColor: "text-caution",
      bgColor: "bg-caution-soft",
      borderColor: "border-caution/30",
      stripColor: "bg-gradient-to-b from-caution to-caution/70",
      label: "Opening soon",
      isUrgent: false
    };
  }

  // By invitation = blue (exclusive/special)
  if (normalized === "enrolling_by_invitation") {
    return {
      textColor: "text-invitation",
      bgColor: "bg-invitation-soft",
      borderColor: "border-invitation/30",
      stripColor: "bg-gradient-to-b from-invitation to-invitation/70",
      label: "By invitation",
      isUrgent: false
    };
  }

  // Ended states = muted
  if (["terminated", "withdrawn", "suspended", "completed"].includes(normalized)) {
    return {
      textColor: "text-muted-foreground",
      bgColor: "bg-muted/30",
      borderColor: "border-border/40",
      stripColor: "bg-gradient-to-b from-border to-border/60",
      label: normalized.charAt(0).toUpperCase() + normalized.slice(1),
      isUrgent: false
    };
  }

  return {
    textColor: "text-muted-foreground",
    bgColor: "bg-muted/20",
    borderColor: "border-border/30",
    stripColor: "bg-border/60",
    label: "Status pending",
    isUrgent: false
  };
}

function formatPhase(phase?: string | null): { label: string; number: number } | null {
  if (!phase) return null;
  const p = phase.toLowerCase();
  if (p.includes("phase 1")) return { label: "Phase 1", number: 1 };
  if (p.includes("phase 2")) return { label: "Phase 2", number: 2 };
  if (p.includes("phase 3")) return { label: "Phase 3", number: 3 };
  if (p.includes("phase 4")) return { label: "Phase 4", number: 4 };
  if (p.includes("early")) return { label: "Early", number: 0 };
  return { label: phase, number: -1 };
}

function formatDurationShort(raw?: number | string | null): string | null {
  if (raw == null) return null;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const days = parsed;
  if (days >= 365) {
    const years = days / 365;
    const rounded = years < 2 ? Math.round(years * 10) / 10 : Math.round(years);
    return `~${rounded} yr`;
  }
  if (days >= 60) {
    const months = Math.round(days / 30);
    return `~${months} mo`;
  }
  if (days >= 14) {
    const weeks = Math.round(days / 7);
    return `~${weeks} wk`;
  }
  return `~${Math.round(days)} d`;
}

function normalizeInterventionMode(value?: string | null): string {
  if (!value) return "";
  return value.trim().toLowerCase();
}

function getInterventionFact(mode?: string | null): { label: string; Icon: typeof Pill } | null {
  const normalized = normalizeInterventionMode(mode);
  if (!normalized) return null;
  if (["drug", "medication", "pill"].includes(normalized)) return { label: "Drug trial", Icon: Pill };
  if (["injection", "infusion"].includes(normalized)) return { label: "Injection trial", Icon: Syringe };
  if (normalized === "behavioral") return { label: "Behavioral study", Icon: Brain };
  if (normalized === "device") return { label: "Device study", Icon: Cpu };
  if (normalized === "procedure") return { label: "Procedure study", Icon: ClipboardList };
  return { label: "Clinical study", Icon: FlaskConical };
}

type PublicTrialCardProps = {
  trial: PublicTrial;
  variant?: CardVariant;
};

export default function PublicTrialCard({ trial, variant = 'standard' }: PublicTrialCardProps) {
  const screenerHref = `/trial/${trial.nct_id}/screen`;
  const detailHref = `/trial/${trial.nct_id}`;
  const statusConfig = getStatusConfig(trial.status_bucket);
  const displayTitle = trial.display_title || trial.title;
  const phaseInfo = formatPhase(trial.phase);
  const isFeatured = variant === 'featured';
  const prefersReducedMotion = useReducedMotion();

  const distanceMiles = trial.distance_miles ?? trial.nearest_site?.distance_miles;
  const facilityName = trial.nearest_site?.facility_name;
  const city = trial.nearest_site?.city;
  const stateCode = trial.nearest_site?.state;
  const locationDisplay = facilityName || [city, stateCode].filter(Boolean).join(", ") || null;

  // Question count and time estimate
  const qJson = trial.questionnaire_json;
  let qCount = qJson?.question_count_total ?? qJson?.question_count;
  if (!qCount && qJson?.sections?.[0]?.questions) {
    qCount = Array.isArray(qJson.sections[0].questions) ? qJson.sections[0].questions.length : 0;
  }
  const estimatedMinutes = qCount ? Math.max(2, Math.round(qCount / 4)) : null;

  // Format distance display
  const distanceDisplay = distanceMiles != null
    ? distanceMiles >= 10
      ? Math.round(distanceMiles)
      : distanceMiles.toFixed(1)
    : null;

  const siteCount = typeof trial.site_count_us === "number" ? trial.site_count_us : null;
  const states = Array.isArray(trial.states_list)
    ? trial.states_list.filter(Boolean)
    : [];
  const statesPreview = states.slice(0, 3).join(", ");
  const statesSuffix = states.length > 3 ? ` +${states.length - 3}` : "";
  const siteLabel = siteCount != null ? `${siteCount} US site${siteCount === 1 ? "" : "s"}` : null;
  const statesLabel = states.length > 0 ? `in ${statesPreview}${statesSuffix}` : null;
  const sitesDisplay = siteLabel && statesLabel
    ? `${siteLabel} ${statesLabel}`
    : siteLabel ?? (statesLabel ? `Sites ${statesLabel}` : null);

  const interventionFact = getInterventionFact(trial.intervention_mode_primary);
  const durationLabel = formatDurationShort(trial.study_duration_days);

  return (
    <motion.article
      whileHover={prefersReducedMotion ? {} : { y: -4, boxShadow: '0 20px 60px -20px rgba(45, 80, 60, 0.25)' }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        "group relative overflow-hidden",
        // Featured cards: larger, warm gradient background
        isFeatured
          ? "p-6 bg-gradient-to-br from-card to-warm-cream/30 rounded-lg"
          : "p-5 bg-card rounded-lg",
        // Shape variation: urgent trials get sharper corners
        !isFeatured && (statusConfig.isUrgent ? "rounded-lg" : "rounded-xl"),
        // Border treatment
        "border",
        statusConfig.isUrgent
          ? "border-urgency/20 hover:border-urgency/40 shadow-[0_0_0_1px_rgba(217,119,6,0.05)]"
          : "border-border/50 hover:border-border"
      )}
    >
      {/* Status indicator strip - subtle */}
      <div
        className={cn(
          "absolute top-0 left-0 h-full",
          statusConfig.stripColor,
          statusConfig.isUrgent ? "w-1.5" : "w-0.5"
        )}
      />

      <div className={cn(statusConfig.isUrgent ? "ml-1.5" : "ml-0.5")}>
        {/* Top row: Status label only (phase removed - too many N/A) */}
        <div className="mb-3">
          {/* Status label - plain text, no background */}
          <span
            className={cn(
              "text-xs font-semibold uppercase tracking-wide",
              statusConfig.textColor
            )}
          >
            {statusConfig.label}
          </span>
        </div>

        {/* Title - using display font for warmth */}
        <Link href={screenerHref} className="group/title block mb-3">
          <h3
            className={cn(
              "font-heading leading-snug line-clamp-2 transition-colors",
              // Featured cards get larger titles
              "text-xl font-semibold text-foreground",
              statusConfig.isUrgent
                ? "group-hover/title:text-urgency"
                : "group-hover/title:text-primary"
            )}
          >
            {displayTitle}
          </h3>
        </Link>

        {/* Distance + Location row */}
        <div className="flex items-center gap-4 mb-4">
          {/* Distance - left-border accent style (de-vibe-coded from rounded pill) */}
          {distanceDisplay != null ? (
            <div className="flex items-baseline gap-1 px-3 py-1.5 bg-distance-soft border-l-2 border-distance rounded">
              <span className="text-xl font-bold tabular-nums text-distance leading-none">
                {distanceDisplay}
              </span>
              <span className="text-[10px] font-semibold text-distance/70 uppercase tracking-wider">
                mi
              </span>
            </div>
          ) : (
            <span className="px-3 py-1.5 bg-secondary/50 border-l-2 border-border text-xs font-medium text-muted-foreground rounded">
              Nationwide
            </span>
          )}

          {/* Location text - no truncation */}
          {locationDisplay && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
              <MapPin size={13} className="shrink-0 text-distance/60" />
              <span className="truncate">{locationDisplay}</span>
            </div>
          )}
        </div>

        {/* Sponsor row - slate color */}
        {trial.sponsor && (
          <div className="flex items-center gap-1.5 mb-4 text-sm">
            <Building2 size={13} className="shrink-0 text-sponsor" />
            <span className="truncate max-w-[280px] text-sponsor font-medium">
              {trial.sponsor}
            </span>
          </div>
        )}

        {/* AI one-liner summary */}
        {trial.card_summary && (
          <p className="text-sm text-muted-foreground leading-snug line-clamp-2 mb-4 -mt-1">
            {trial.card_summary}
          </p>
        )}

        {(interventionFact || durationLabel) && (
          <QuickFacts
            className="mb-4"
            items={[
              interventionFact
                ? { icon: <interventionFact.Icon size={12} />, label: interventionFact.label }
                : null,
              durationLabel
                ? { icon: <Calendar size={12} />, label: durationLabel }
                : null,
            ].filter(Boolean) as { icon: ReactElement; label: string }[]}
          />
        )}

        {sitesDisplay && (
          <div className="flex items-center gap-1.5 mb-4 text-xs text-muted-foreground">
            <MapPin size={12} className="shrink-0 text-distance/60" />
            <span className="truncate max-w-[320px]">{sitesDisplay}</span>
          </div>
        )}

        {/* Footer: Meta + CTA */}
        <div className="flex items-center justify-between gap-4 pt-3 border-t border-border/30">
          {/* Left: NCT ID + Effort */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <a
              href={`https://clinicaltrials.gov/study/${trial.nct_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group/nct inline-flex items-center gap-1 font-mono hover:text-primary transition-colors"
            >
              {trial.nct_id}
              <ExternalLink size={9} className="opacity-40 group-hover/nct:opacity-100" />
            </a>

            {qCount && qCount > 0 && (
              <>
                <span className="text-border">•</span>
                <span className="flex items-center gap-1">
                  <FileText size={11} className="text-muted-foreground/60" />
                  {qCount} questions
                </span>
              </>
            )}

            {estimatedMinutes && (
              <>
                <span className="text-border">•</span>
                <span className="flex items-center gap-1">
                  <Clock size={11} className="text-muted-foreground/60" />
                  ~{estimatedMinutes} min
                </span>
              </>
            )}
          </div>

          {/* CTA */}
          <div className="flex items-center gap-2">
            <Link
              href={detailHref}
              className="inline-flex items-center rounded-md px-2 py-1 text-sm font-medium text-primary underline-offset-4 transition hover:text-primary/80 hover:underline"
            >
              View details
            </Link>
            <Button
              variant="brand"
              size="sm"
              className="shrink-0 font-semibold"
              asChild
            >
              <Link href={screenerHref}>
                Start eligibility check
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

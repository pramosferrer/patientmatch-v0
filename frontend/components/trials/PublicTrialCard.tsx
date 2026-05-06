"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ExternalLink, Clock, FileText, MapPin } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { MatchConfidenceResult } from "@/lib/matching/matchConfidence";
import { screenerHref, trialHref } from "@/lib/urls";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PublicTrial = {
  nct_id: string;
  title: string;
  display_title?: string | null;
  status_bucket?: string | null;
  conditions?: string[] | string | null;
  quality_score?: number | null;
  patient_readiness_score?: number | null;
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

export type CardLayout = "row" | "card";

type PublicTrialCardProps = {
  trial: PublicTrial;
  layout?: CardLayout;
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

type StatusConfig = {
  dotColor: string;
  textColor: string;
  label: string;
  isUrgent: boolean;
};

function getStatusConfig(bucket?: string | null): StatusConfig {
  const b = typeof bucket === "string" ? bucket.trim().toLowerCase() : "";
  if (b === "recruiting" || b === "active")
    return { dotColor: "#D97706", textColor: "text-urgency", label: "Enrolling now", isUrgent: true };
  if (b === "not_yet_recruiting")
    return { dotColor: "#0E7490", textColor: "text-caution", label: "Opening soon", isUrgent: false };
  if (b === "enrolling_by_invitation")
    return { dotColor: "#2563EB", textColor: "text-invitation", label: "By invitation", isUrgent: false };
  return { dotColor: "#9CA3AF", textColor: "text-muted-foreground", label: "Ended", isUrgent: false };
}

function isScreenableStatus(bucket?: string | null): boolean {
  const b = typeof bucket === "string" ? bucket.trim().toLowerCase() : "";
  return b === "recruiting" || b === "active";
}

function formatDistance(d: number | null | undefined): string | null {
  if (d == null) return null;
  return d >= 10 ? `${Math.round(d)}` : d.toFixed(1);
}

function qMeta(trial: PublicTrial): { count: number | null; minutes: number | null } {
  const qJson = trial.questionnaire_json;
  let count = qJson?.question_count_total ?? qJson?.question_count ?? null;
  if (!count && Array.isArray(qJson?.sections?.[0]?.questions)) {
    count = qJson.sections[0].questions.length || null;
  }
  const minutes = count ? Math.max(2, Math.round(count / 4)) : null;
  return { count, minutes };
}

function sitesText(trial: PublicTrial): string | null {
  const n = typeof trial.site_count_us === "number" ? trial.site_count_us : null;
  const states = Array.isArray(trial.states_list) ? trial.states_list.filter(Boolean) : [];
  const preview = states.slice(0, 3).join(", ");
  const suffix = states.length > 3 ? ` +${states.length - 3}` : "";
  if (n != null && states.length > 0) return `${n} site${n === 1 ? "" : "s"} in ${preview}${suffix}`;
  if (n != null) return `${n} US site${n === 1 ? "" : "s"}`;
  if (states.length > 0) return `Sites in ${preview}${suffix}`;
  return null;
}

function formatPhase(phase?: string | null): string | null {
  if (!phase) return null;
  const p = phase.trim();
  // "Phase 1/Phase 2" → "Ph 1/2", "Phase 3" → "Ph 3"
  const normalized = p
    .replace(/Phase\s*(\d)/gi, 'Ph $1')
    .replace(/Ph\s+(\d)\/Ph\s+(\d)/gi, 'Ph $1/$2');
  // Skip "N/A", "Not Applicable", or anything that didn't simplify
  if (/n\/?a/i.test(normalized) || normalized === p) return null;
  return normalized;
}

function formatDuration(days?: number | string | null): string | null {
  const d = typeof days === 'string' ? parseFloat(days) : days;
  if (!d || isNaN(d) || d <= 0) return null;
  if (d < 14) return `${Math.round(d)}d`;
  if (d < 60) return `~${Math.round(d / 7)}wk`;
  if (d < 365 * 1.5) return `~${Math.round(d / 30)}mo`;
  const yrs = d / 365;
  return `~${yrs < 1.75 ? '1.5' : Math.round(yrs)}yr`;
}

const INTERVENTION_LABELS: Record<string, string> = {
  drug: 'Drug',
  biological: 'Biologic',
  device: 'Device',
  behavioral: 'Lifestyle',
  procedure: 'Procedure',
  radiation: 'Radiation',
  dietary: 'Dietary',
  genetic: 'Genetic',
};

function getIntervention(mode?: string | null): string | null {
  if (!mode) return null;
  const key = mode.trim().toLowerCase();
  for (const [k, v] of Object.entries(INTERVENTION_LABELS)) {
    if (key.includes(k)) return v;
  }
  return null;
}

// ─── Row layout ───────────────────────────────────────────────────────────────

function RowCard({ trial }: { trial: PublicTrial }) {
  const searchParams = useSearchParams();
  const preservedZip = searchParams.get("zip")?.trim() || undefined;
  const detailHref = trialHref({ nct_id: trial.nct_id }, { zip: preservedZip });
  const screenerLink = screenerHref({ nct_id: trial.nct_id }, { zip: preservedZip });
  const status = getStatusConfig(trial.status_bucket);
  const isScreenable = isScreenableStatus(trial.status_bucket);
  const displayTitle = trial.display_title || trial.title;
  const distanceMiles = trial.distance_miles ?? trial.nearest_site?.distance_miles;
  const distStr = formatDistance(distanceMiles);
  const facility = trial.nearest_site?.facility_name
    ?? [trial.nearest_site?.city, trial.nearest_site?.state].filter(Boolean).join(", ")
    ?? null;
  const { count: qCount, minutes } = qMeta(trial);
  const sites = sitesText(trial);
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.article
      whileHover={prefersReducedMotion ? {} : { backgroundColor: "rgba(0,0,0,0.012)" }}
      transition={{ duration: 0.12 }}
      className="group flex items-start gap-4 border-b border-border/25 py-4 last:border-0"
    >
      {/* Distance column */}
      <div className="w-14 shrink-0 flex flex-col items-center justify-center pt-0.5">
        {distStr != null ? (
          <>
            <span className="text-[22px] font-bold tabular-nums leading-none text-distance">
              {distStr}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-distance/60 mt-0.5">
              mi
            </span>
          </>
        ) : (
          <span className="text-[11px] font-medium text-muted-foreground/50 text-center leading-tight">
            Nationwide
          </span>
        )}
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <Link href={detailHref} className="block group/title">
          <h3 className="text-[14.5px] font-semibold leading-snug line-clamp-2 text-foreground transition-colors group-hover/title:text-primary">
            {displayTitle}
          </h3>
        </Link>

        {/* Facility / location */}
        {facility && (
          <p className="mt-1 text-[12.5px] text-muted-foreground truncate">
            {facility}
            {trial.sponsor && trial.sponsor !== facility && (
              <span className="text-muted-foreground/50"> · {trial.sponsor}</span>
            )}
          </p>
        )}
        {!facility && trial.sponsor && (
          <p className="mt-1 text-[12.5px] text-muted-foreground truncate">{trial.sponsor}</p>
        )}

        {/* Trial metadata row */}
        {(() => {
          const intervention = getIntervention(trial.intervention_mode_primary);
          const phase = formatPhase(trial.phase);
          const duration = formatDuration(trial.study_duration_days);
          const parts: React.ReactNode[] = [];
          if (intervention) parts.push(
            <span key="intv" className="font-medium text-foreground/55">{intervention}</span>
          );
          if (phase) parts.push(<span key="ph">{phase}</span>);
          if (duration) parts.push(<span key="dur">{duration}</span>);
          if (sites) parts.push(
            <span key="sites" className="flex items-center gap-1">
              <MapPin size={10} className="shrink-0" />{sites}
            </span>
          );
          if (parts.length === 0) return null;
          return (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted-foreground/50">
              {parts.map((p, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <span className="text-border select-none">·</span>}
                  {p}
                </span>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Right column: status + meta + CTA */}
      <div className="w-40 shrink-0 flex flex-col items-end gap-2">
        {/* Status */}
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-[7px] w-[7px] rounded-full shrink-0"
            style={{ background: status.dotColor }}
          />
          <span className={cn("text-[11.5px] font-semibold", status.textColor)}>
            {status.label}
          </span>
        </div>

        {/* Effort meta */}
        {(qCount || minutes) && (
          <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground/70">
            {qCount && (
              <span className="flex items-center gap-1">
                <FileText size={10} />
                {qCount}q
              </span>
            )}
            {minutes && (
              <span className="flex items-center gap-1">
                <Clock size={10} />
                ~{minutes}min
              </span>
            )}
          </div>
        )}

        {/* CTA */}
        {isScreenable ? (
          <Button variant="brand" size="sm" className="h-7 px-3 text-[12px] font-semibold w-full" asChild>
            <Link href={screenerLink}>Check if I qualify</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-7 px-3 text-[12px] font-semibold w-full" asChild>
            <Link href={detailHref}>View study</Link>
          </Button>
        )}

        <Link
          href={detailHref}
          className="text-[11.5px] font-medium text-muted-foreground/60 hover:text-primary transition-colors flex items-center gap-0.5"
        >
          View study
          <ExternalLink size={9} className="opacity-60" />
        </Link>
      </div>
    </motion.article>
  );
}

// ─── Card layout (used on conditions page 3-col grid) ────────────────────────

function CardCard({ trial }: { trial: PublicTrial }) {
  const searchParams = useSearchParams();
  const preservedZip = searchParams.get("zip")?.trim() || undefined;
  const detailHref = trialHref({ nct_id: trial.nct_id }, { zip: preservedZip });
  const screenerLink = screenerHref({ nct_id: trial.nct_id }, { zip: preservedZip });
  const status = getStatusConfig(trial.status_bucket);
  const isScreenable = isScreenableStatus(trial.status_bucket);
  const displayTitle = trial.display_title || trial.title;
  const distanceMiles = trial.distance_miles ?? trial.nearest_site?.distance_miles;
  const distStr = formatDistance(distanceMiles);
  const facility = trial.nearest_site?.facility_name
    ?? [trial.nearest_site?.city, trial.nearest_site?.state].filter(Boolean).join(", ")
    ?? null;
  const { count: qCount, minutes } = qMeta(trial);
  const sites = sitesText(trial);
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.article
      whileHover={prefersReducedMotion ? {} : { y: -3, boxShadow: "0 12px 40px -12px rgba(45,80,60,0.18)" }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="group flex flex-col rounded-xl border border-border/50 bg-card p-5 hover:border-border"
    >
      {/* Status */}
      <div className="mb-3 flex items-center gap-1.5">
        <span
          className="inline-block h-[7px] w-[7px] rounded-full shrink-0"
          style={{ background: status.dotColor }}
        />
        <span className={cn("text-[11px] font-bold uppercase tracking-[0.09em]", status.textColor)}>
          {status.label}
        </span>
      </div>

      {/* Title */}
      <Link href={detailHref} className="block group/title mb-3">
        <h3 className="text-[15px] font-semibold leading-snug line-clamp-2 text-foreground transition-colors group-hover/title:text-primary">
          {displayTitle}
        </h3>
      </Link>

      {/* Distance + location */}
      <div className="mb-3 flex items-center gap-2.5">
        {distStr != null ? (
          <span className="inline-flex items-baseline gap-0.5 rounded-md bg-distance-soft px-2 py-0.5 text-distance">
            <span className="text-[16px] font-bold tabular-nums leading-none">{distStr}</span>
            <span className="text-[10px] font-semibold uppercase">mi</span>
          </span>
        ) : (
          <span className="rounded-md bg-secondary/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            Nationwide
          </span>
        )}
        {facility && (
          <span className="truncate text-[12.5px] text-muted-foreground">{facility}</span>
        )}
      </div>

      {/* Sponsor */}
      {trial.sponsor && (
        <p className="mb-2 truncate text-[12.5px] text-muted-foreground/70">{trial.sponsor}</p>
      )}

      {/* Summary */}
      {trial.card_summary && (
        <p className="mb-3 line-clamp-2 text-[12.5px] italic leading-snug text-muted-foreground/70">
          {trial.card_summary}
        </p>
      )}

      {/* Sites */}
      {sites && (
        <p className="mb-3 flex items-center gap-1 text-[12px] text-muted-foreground/60">
          <MapPin size={11} className="shrink-0" />
          {sites}
        </p>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/30 pt-3">
        <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground/60">
          <a
            href={`https://clinicaltrials.gov/study/${trial.nct_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono hover:text-primary transition-colors inline-flex items-center gap-0.5"
          >
            {trial.nct_id}
            <ExternalLink size={9} className="opacity-40" />
          </a>
          {qCount && (
            <>
              <span className="text-border">·</span>
              <span className="flex items-center gap-0.5"><FileText size={10} />{qCount}q</span>
            </>
          )}
          {minutes && (
            <>
              <span className="text-border">·</span>
              <span className="flex items-center gap-0.5"><Clock size={10} />~{minutes}min</span>
            </>
          )}
        </div>
        {isScreenable ? (
          <Button variant="brand" size="sm" className="h-7 shrink-0 px-3 text-[12px] font-semibold" asChild>
            <Link href={screenerLink}>Check if I qualify</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-7 shrink-0 px-3 text-[12px] font-semibold" asChild>
            <Link href={detailHref}>View study</Link>
          </Button>
        )}
      </div>
    </motion.article>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function PublicTrialCard({ trial, layout = "card" }: PublicTrialCardProps) {
  return layout === "row"
    ? <RowCard trial={trial} />
    : <CardCard trial={trial} />;
}

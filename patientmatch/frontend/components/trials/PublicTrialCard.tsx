import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toConditionLabel, toConditionSlug } from "@/shared/conditions-normalize";
import { cn } from "@/lib/utils";
import { Building2, FlaskConical, MapPin, ExternalLink } from "lucide-react";
import { MatchMeter } from "./MatchMeter";
import type { MatchConfidenceResult } from "@/lib/matching/matchConfidence";

export type PublicTrial = {
  nct_id: string;
  title: string;
  status_bucket?: string | null;
  conditions?: string[] | string | null;
  quality_score?: number | null;
  distance_miles?: number | null;
  sponsor?: string | null;
  phase?: string | null;
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
};

function normalizeConditions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
}

function formatQualityScore(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  const scaled = parsed <= 1 ? parsed * 100 : parsed;
  return Math.round(scaled);
}

function getProfileFitColor(score: number | null): string {
  if (score === null) return "text-slate-400";
  if (score >= 90) return "text-emerald-600";
  if (score >= 70) return "text-amber-600";
  return "text-slate-400";
}

function getStatusStripColor(bucket?: string | null): string {
  const normalized = typeof bucket === "string" ? bucket.trim().toLowerCase() : "";

  // Currently Enrolling (Recruiting): Emerald Green
  if (normalized === "recruiting" || normalized === "active") {
    return "bg-emerald-500";
  }

  // Opening Soon (Not yet recruiting): Amber/Yellow
  if (normalized === "not_yet_recruiting") {
    return "bg-amber-500";
  }

  // Enrolling by Invitation (Active): Blue
  if (normalized === "enrolling_by_invitation") {
    return "bg-blue-500";
  }

  // Stopped/Closed: Rose Red
  if (["terminated", "withdrawn", "suspended", "completed"].includes(normalized)) {
    return "bg-rose-500";
  }

  // Status Unknown or other: Slate Gray
  return "bg-slate-300";
}

function formatStatusLabel(bucket?: string | null): string {
  const normalized = typeof bucket === "string" ? bucket.trim().toLowerCase() : "";
  if (normalized === "recruiting") return "Currently enrolling";
  if (normalized === "active") return "Active";
  if (normalized === "not_yet_recruiting") return "Opening soon";
  if (normalized === "enrolling_by_invitation") return "By invitation";
  if (normalized === "completed") return "Completed";
  if (normalized === "terminated") return "Terminated";
  if (normalized === "withdrawn") return "Withdrawn";
  if (normalized === "suspended") return "Suspended";
  return "Enrollment status pending";
}

function formatPhase(phase?: string | null): string {
  if (!phase) return "Phase N/A";
  const p = phase.toLowerCase();
  if (p.includes("phase 1")) return "Phase 1";
  if (p.includes("phase 2")) return "Phase 2";
  if (p.includes("phase 3")) return "Phase 3";
  if (p.includes("phase 4")) return "Phase 4";
  if (p.includes("early")) return "Early Phase";
  return phase;
}

export default function PublicTrialCard({ trial }: { trial: PublicTrial }) {
  const qualityScore = formatQualityScore(trial.quality_score);
  const profileFitColor = getProfileFitColor(qualityScore);
  const statusStripColor = getStatusStripColor(trial.status_bucket);
  const screenerHref = `/trial/${trial.nct_id}/screen`;

  const distanceMiles = trial.distance_miles ?? trial.nearest_site?.distance_miles;
  const facilityName = trial.nearest_site?.facility_name;
  const city = trial.nearest_site?.city;
  const stateCode = trial.nearest_site?.state;
  const statusLabel = formatStatusLabel(trial.status_bucket);
  const phaseLabel = formatPhase(trial.phase);

  return (
    <article className="group relative flex items-stretch border-b border-slate-100 bg-white hover:bg-slate-50/50 transition-colors last:border-b-0">
      {/* Status Strip */}
      <div className={cn("w-1 shrink-0", statusStripColor)} />

      {/* Logistics Lane (15%) - Top Aligned */}
      <div className="w-[15%] flex flex-col justify-start items-start gap-1 p-6 py-3 border-r border-slate-100/50">
        {/* Distance / Nationwide */}
        <div className="">
          {distanceMiles != null ? (
            <div className="flex items-baseline gap-0.5">
              <div className="text-2xl font-bold text-slate-900 leading-none">
                {distanceMiles >= 10 ? Math.round(distanceMiles) : distanceMiles.toFixed(1)}
              </div>
              <span className="text-[10px] text-slate-500 font-bold uppercase leading-none">mi</span>
            </div>
          ) : (
            <div className="text-[10px] uppercase font-bold text-slate-400 leading-tight">
              Nationwide
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 mt-1">
          {/* Status Label (Normalized) */}
          <span className={cn(
            "text-[12px] font-bold tracking-tight",
            statusLabel === "Currently enrolling" ? "text-emerald-600" : "text-slate-500"
          )}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Identity Column (40%) - Title & NCT */}
      <div className="w-[40%] flex flex-col justify-start gap-1 p-6 py-3 border-r border-slate-100/50">
        <Link href={screenerHref} className="group/title">
          <h3 className="text-lg font-semibold leading-tight text-slate-900 group-hover/title:text-rose-600 transition-colors">
            {trial.title}
          </h3>
        </Link>

        {/* NCT ID */}
        <div className="mt-1">
          <a
            href={`https://clinicaltrials.gov/study/${trial.nct_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group/nct inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-rose-600 transition-colors"
          >
            {trial.nct_id}
            <ExternalLink size={10} className="text-slate-300 group-hover/nct:text-rose-400" />
          </a>
        </div>
      </div>

      {/* Logistics Column (33%) - Vertical Stack */}
      <div className="w-[33%] flex flex-col justify-start gap-2 p-6 py-4 border-r border-slate-100/50 text-sm">
        {/* Nearest Site - Only show when we have actual location data */}
        {(facilityName || city || stateCode) ? (
          <div className="flex items-start gap-2.5">
            <MapPin size={16} className="text-slate-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-slate-900 font-semibold truncate leading-snug">
                {facilityName || "Study Site"}
              </span>
              {(city || stateCode) && (
                <span className="text-slate-500 text-xs">
                  {[city, stateCode].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2.5">
            <MapPin size={16} className="text-slate-300 shrink-0 mt-0.5" />
            <span className="text-slate-400 text-xs italic">
              See trial details for locations
            </span>
          </div>
        )}

        {/* Sponsor - hide if same as facility name */}
        {trial.sponsor && trial.sponsor.toLowerCase() !== facilityName?.toLowerCase() && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Building2 size={12} className="shrink-0" />
            <span className="truncate">
              Sponsor: {trial.sponsor}
            </span>
          </div>
        )}
      </div>

      {/* Action Column (12%) */}
      <div className="w-[12%] flex flex-col items-center justify-center p-3 py-3 gap-2">
        <Button
          variant="ghost"
          className="w-full bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-700 font-semibold h-auto py-2.5 rounded-none text-[11px] leading-3 whitespace-normal text-center px-2 transition-all"
          asChild
        >
          <Link href={screenerHref}>
            Check<br />Eligibility
          </Link>
        </Button>

        {/* Effort Estimate */}
        {(() => {
          const questions = trial.questionnaire_json?.sections?.[0]?.questions;
          if (!questions || !Array.isArray(questions) || questions.length === 0) return null;
          const qCount = questions.length;
          const estimatedMinutes = Math.max(2, Math.round(qCount / 4));
          return (
            <span className="text-[11px] text-slate-500 font-bold whitespace-nowrap mt-1 bg-slate-50 px-2 py-0.5 rounded-none border border-slate-100">
              ~{estimatedMinutes} min • {qCount} questions
            </span>
          );
        })()}
      </div>
    </article >
  );
}

"use client";

import { useMemo } from "react";
import { Activity, Route } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

function normalizeScore(value?: number | string | null): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function scoreToLabel(score: number): string {
  if (score < 34) return "Low";
  if (score < 67) return "Moderate";
  return "High";
}

function scoreToTone(score: number): string {
  if (score < 34) return "bg-affirm";
  if (score < 67) return "bg-caution";
  return "bg-urgency";
}

type ParticipationEffortProps = {
  burdenScore?: number | string | null;
  logisticsScore?: number | string | null;
};

export default function ParticipationEffort({
  burdenScore,
  logisticsScore,
}: ParticipationEffortProps) {
  const prefersReducedMotion = useReducedMotion();
  const burden = useMemo(() => normalizeScore(burdenScore), [burdenScore]);
  const logistics = useMemo(() => normalizeScore(logisticsScore), [logisticsScore]);

  if (burden == null && logistics == null) return null;

  return (
    <section className="rounded-2xl border border-border/60 bg-white/90 p-6 shadow-[0_24px_48px_rgba(15,23,42,0.08)]">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">Participation effort</h2>
        <p className="text-sm text-muted-foreground">
          Estimated from trial records. Details can vary by site.
        </p>
      </div>

      <div className="mt-5 space-y-4">
        {burden != null && (
          <div className="rounded-xl border border-border/40 bg-white/60 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Activity className="h-4 w-4 text-muted-foreground/70" aria-hidden="true" />
              <span>Time + visits</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="font-semibold text-foreground">{scoreToLabel(burden)}</span>
              <span className="text-muted-foreground">{burden}%</span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-muted/40">
              <motion.div
                initial={prefersReducedMotion ? false : { width: 0 }}
                whileInView={prefersReducedMotion ? undefined : { width: `${burden}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                viewport={{ once: true, amount: 0.4 }}
                style={prefersReducedMotion ? { width: `${burden}%` } : undefined}
                className={`h-2 rounded-full ${scoreToTone(burden)}`}
              />
            </div>
          </div>
        )}

        {logistics != null && (
          <div className="rounded-xl border border-border/40 bg-white/60 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Route className="h-4 w-4 text-muted-foreground/70" aria-hidden="true" />
              <span>Logistics</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="font-semibold text-foreground">{scoreToLabel(logistics)}</span>
              <span className="text-muted-foreground">{logistics}%</span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-muted/40">
              <motion.div
                initial={prefersReducedMotion ? false : { width: 0 }}
                whileInView={prefersReducedMotion ? undefined : { width: `${logistics}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                viewport={{ once: true, amount: 0.4 }}
                style={prefersReducedMotion ? { width: `${logistics}%` } : undefined}
                className={`h-2 rounded-full ${scoreToTone(logistics)}`}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Logistics difficulty varies by site location and availability.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

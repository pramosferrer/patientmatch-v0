import { CheckCircle2, ClipboardCheck } from "lucide-react";
import type { TrialInsights } from "@/components/trial/TrialEnrichments";
import { normalizePossiblyEncodedJson } from "@/lib/trials/json";
import { cn } from "@/lib/utils";

type PlainSummary = {
  summary?: string | null;
  what_you_do?: Array<{ text?: string | null; confidence?: string | null }> | null;
};

type PatientInsights = {
  participant_actions?: Array<{ text?: string | null; confidence?: string | null }> | null;
};

function normalizeActions(source?: Array<{ text?: string | null }> | null): string[] {
  if (!Array.isArray(source)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of source) {
    const raw = typeof item?.text === "string" ? item.text.trim() : "";
    if (!raw) continue;
    const cleaned = raw.replace(/\s+/g, " ").replace(/[.;:]+$/, "").trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const normalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    out.push(normalized);
  }
  return out;
}

export default function TrialSummary({
  insights,
  fallbackSummary,
}: {
  insights: TrialInsights | null | undefined;
  fallbackSummary?: string | null;
}) {
  if (!insights) return null;

  const summary = normalizePossiblyEncodedJson<PlainSummary>(insights.plain_summary_json);
  const patient = normalizePossiblyEncodedJson<PatientInsights>(insights.patient_insights_json);
  const summaryText = typeof summary?.summary === "string" ? summary.summary.trim() : "";

  const actions = normalizeActions(summary?.what_you_do);
  const fallbackActions = actions.length > 0 ? actions : normalizeActions(patient?.participant_actions);

  const hasSummary = Boolean(summaryText);
  const hasActions = fallbackActions.length > 0;
  const resolvedSummary = hasSummary ? summaryText : (fallbackSummary?.trim() ?? "");
  const hasResolvedSummary = Boolean(resolvedSummary);
  const visibleActions = fallbackActions.slice(0, 3);
  const remainingActions = Math.max(0, fallbackActions.length - visibleActions.length);

  if (!hasResolvedSummary && !hasActions) return null;

  return (
    <section className="rounded-2xl border border-border/60 bg-white/90 p-6 shadow-[0_2px_4px_rgba(45,80,60,0.05),_0_16px_48px_-12px_rgba(45,80,60,0.12)]">
      <div className={cn("grid gap-6", hasResolvedSummary && hasActions ? "md:grid-cols-2" : "")}>
        {hasResolvedSummary && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-display font-normal text-foreground">What this study is about</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{resolvedSummary}</p>
            <p className="text-xs text-muted-foreground">
              Simplified from trial records by PatientMatch.
            </p>
          </div>
        )}

        {hasActions && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              What you may be asked to do
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {visibleActions.map((action, index) => (
                <li key={action} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-affirm" aria-hidden="true" />
                  <span className="text-affirm font-semibold tabular-nums">{index + 1}.</span>
                  <span>{action}</span>
                </li>
              ))}
              {remainingActions > 0 && (
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    +{remainingActions} more
                  </span>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

import type { TrialInsights } from "@/components/trial/TrialEnrichments";

type Chip = { label: string; value: string };

function normalizePhase(phase?: string | null): string | null {
  if (!phase) return null;
  const raw = phase.trim();
  const key = raw.toUpperCase().replace(/[\s_-]+/g, "");
  if (["NA", "N/A", "NOTAPPLICABLE"].includes(key)) return null;
  const cleaned = raw.replace(/PHASE\s*/gi, "Phase ").replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function cleanValue(value?: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").replace(/[.;:]+$/, "").trim();
  return cleaned || null;
}

function buildChips(
  insights: TrialInsights | null | undefined,
  phase?: string | null,
): Chip[] {
  const chips: Chip[] = [];

  const phaseLabel = normalizePhase(phase);
  if (phaseLabel) chips.push({ label: "Phase", value: phaseLabel });

  const firstDrug = insights?.drug_classes_json?.[0];
  const drugName = cleanValue(firstDrug?.drug_name ?? firstDrug?.drug_class ?? null);
  if (drugName) chips.push({ label: "Drug", value: drugName });

  const firstRoute = insights?.drug_routes_json?.[0];
  const routeName = cleanValue(firstRoute?.route ?? firstRoute?.formulation ?? null);
  if (routeName) chips.push({ label: "Route", value: routeName });

  const primaryEndpoint = insights?.endpoint_categories_json?.find(
    (entry) => String(entry.outcome_type ?? "").toLowerCase() === "primary",
  );
  const endpointText = cleanValue(
    primaryEndpoint?.endpoint ?? primaryEndpoint?.endpoint_category ?? null,
  );
  if (endpointText) chips.push({ label: "Primary goal", value: endpointText });

  return chips.slice(0, 4);
}

export default function TreatmentSnapshot({
  insights,
  phase,
}: {
  insights: TrialInsights | null | undefined;
  phase?: string | null;
}) {
  const chips = buildChips(insights, phase);
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <div
          key={chip.label}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-white/70 px-3 py-1.5 text-xs shadow-sm"
        >
          <span className="font-semibold uppercase tracking-wide text-muted-foreground/70">
            {chip.label}
          </span>
          <span className="text-foreground">{chip.value}</span>
        </div>
      ))}
    </div>
  );
}

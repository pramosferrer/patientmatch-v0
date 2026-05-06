import {
  ClipboardList,
  Cpu,
  Pill,
  Stethoscope,
  Syringe,
  Target,
} from "lucide-react";

export type TrialInsights = {
  plain_summary_json?: unknown | null;
  patient_insights_json?: {
    intervention_modes?: string[];
    participant_actions?: Array<{ text?: string; confidence?: string; source?: string }>;
    [key: string]: unknown;
  } | null;
  top_disqualifiers_json?: unknown | null;
  burden_score?: number | null;
  logistics_score?: number | null;
  strictness_score?: number | null;
  condition_body_systems_json?: Record<string, string[]> | null;
  drug_classes_json?: Array<{
    drug_name?: string;
    drug_class?: string;
    class_secondary?: string;
    mechanism?: string;
    confidence?: string;
  }> | null;
  drug_routes_json?: Array<{
    drug_name?: string;
    route?: string;
    formulation?: string;
    secondary_routes?: string;
    route_context?: string;
    confidence?: string;
  }> | null;
  endpoint_categories_json?: Array<{
    endpoint?: string;
    endpoint_category?: string;
    measure_type?: string;
    typical_phase?: string;
    outcome_type?: string;
    confidence?: string;
  }> | null;
  procedure_categories_json?: Array<{
    procedure_name?: string;
    procedure_category?: string;
    intent?: string;
    body_system?: string;
    confidence?: string;
  }> | null;
  device_categories_json?: Array<{
    device_name?: string;
    device_category?: string;
    intent?: string;
    body_system?: string;
    confidence?: string;
  }> | null;
};

const ITEM_LIMIT = 8;
const LOW_SIGNAL = new Set([
  "other",
  "unknown",
  "unspecified",
  "misc",
  "miscellaneous",
  "n/a",
  "na",
  "symptom",
  "symptoms",
]);

const BODY_SYSTEM_LABELS: Record<string, string | null> = {
  onco: "Oncology",
  cardio: "Cardiology / Heart",
  neuro: "Neurology",
  immuno: "Immunology / Autoimmune",
  endo: "Endocrinology",
  gastro: "Gastroenterology",
  pulm: "Pulmonology / Respiratory",
  heme: "Hematology",
  musculo: "Musculoskeletal",
  derm: "Dermatology",
  ophthal: "Ophthalmology",
  urology: "Urology / Renal",
  psych: "Psychiatry / Mental Health",
  infect: "Infectious Disease",
  repro: "Reproductive Health",
  pediatric: "Pediatrics",
  geri: "Geriatrics",
  other: null,
  unknown: null,
};

function toTitleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ")
    .trim();
}

function uniq(values: Array<string | null | undefined>, limit = ITEM_LIMIT): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    if (!raw) continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (LOW_SIGNAL.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= limit) break;
  }
  return out;
}

function formatDrugClass(row: {
  drug_class?: string;
  class_secondary?: string;
  mechanism?: string;
}): string | null {
  const primary = row.drug_class || row.class_secondary || row.mechanism;
  if (!primary) return null;
  const mechanism = row.mechanism && row.mechanism !== primary ? row.mechanism : null;
  return mechanism ? `${primary} (${mechanism})` : primary;
}

function formatDrugRoute(row: {
  route?: string;
  formulation?: string;
  route_context?: string;
  secondary_routes?: string;
}): string | null {
  const primary = row.route || row.formulation || row.route_context || row.secondary_routes;
  if (!primary) return null;
  const secondary = row.formulation && row.formulation !== primary ? row.formulation : null;
  return secondary ? `${primary} (${secondary})` : primary;
}

function buildSections(insights: TrialInsights) {
  const bodySystems = uniq(
    Object.keys(insights.condition_body_systems_json ?? {}).map((key) => {
      if (key in BODY_SYSTEM_LABELS) return BODY_SYSTEM_LABELS[key];
      return toTitleCase(key);
    }),
  );
  const drugClasses = uniq(
    (insights.drug_classes_json ?? []).map((row) => formatDrugClass(row) ?? null),
  );
  const drugRoutes = uniq(
    (insights.drug_routes_json ?? []).map((row) => formatDrugRoute(row) ?? null),
  );

  const endpointsRaw = insights.endpoint_categories_json ?? [];
  const primaryEndpoints = uniq(
    endpointsRaw
      .filter((row) => String(row.outcome_type || "").toLowerCase() === "primary")
      .map((row) => row.endpoint || row.endpoint_category || row.measure_type || null),
  );
  const secondaryEndpoints = uniq(
    endpointsRaw
      .filter((row) => String(row.outcome_type || "").toLowerCase() === "secondary")
      .map((row) => row.endpoint || row.endpoint_category || row.measure_type || null),
  );
  const otherEndpoints = uniq(
    endpointsRaw
      .filter((row) => {
        const key = String(row.outcome_type || "").toLowerCase();
        return key !== "primary" && key !== "secondary";
      })
      .map((row) => row.endpoint || row.endpoint_category || row.measure_type || null),
  );

  const procedures = uniq(
    (insights.procedure_categories_json ?? []).map(
      (row) => row.procedure_category || row.intent || row.body_system || null,
    ),
  );
  const devices = uniq(
    (insights.device_categories_json ?? []).map(
      (row) => row.device_category || row.intent || row.body_system || null,
    ),
  );

  const sections = [
    { title: "Drug classes", icon: Pill, items: drugClasses },
    { title: "Drug routes", icon: Syringe, items: drugRoutes },
    {
      title: "Endpoints",
      icon: Target,
      items: [],
      groups: [
        primaryEndpoints.length > 0 ? { label: "Primary", items: primaryEndpoints } : null,
        secondaryEndpoints.length > 0 ? { label: "Secondary", items: secondaryEndpoints } : null,
        otherEndpoints.length > 0 ? { label: "Other", items: otherEndpoints } : null,
      ].filter(Boolean) as Array<{ label: string; items: string[] }>,
    },
    { title: "Procedures", icon: ClipboardList, items: procedures },
    { title: "Devices", icon: Cpu, items: devices },
    { title: "Body systems", icon: Stethoscope, items: bodySystems },
  ];

  return sections.filter((section) => {
    if (section.groups && section.groups.length > 0) return true;
    return section.items.length > 0;
  });
}

export default function TrialEnrichments({
  insights,
}: {
  insights: TrialInsights | null | undefined;
}) {
  if (!insights) return null;
  const sections = buildSections(insights);
  if (sections.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border/60 bg-white/90 p-6 shadow-[0_2px_4px_rgba(45,80,60,0.05),_0_16px_48px_-12px_rgba(45,80,60,0.12)]">
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-display font-normal text-foreground">Extracted study details</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Pulled from the trial record to show what is being tested and what the study is measuring.
          </p>
        </div>
      </div>
      <div className="mt-5 space-y-4">
        {sections.map((section) => {
          const Icon = section.icon;
          const items = section.items ?? [];
          const displayItems = items.slice(0, ITEM_LIMIT);
          const remaining = items.length - displayItems.length;

          return (
            <div
              key={section.title}
              className="rounded-xl border border-border/60 bg-white/70 p-4"
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Icon className="h-4 w-4 text-muted-foreground/70" aria-hidden="true" />
                <span>{section.title}</span>
              </div>

              {section.groups && section.groups.length > 0 ? (
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {section.groups.map((group) => (
                    <p key={`${section.title}-${group.label}`}>
                      <span className="font-semibold text-foreground/80">{group.label}:</span>{" "}
                      {group.items.slice(0, ITEM_LIMIT).join(", ")}
                      {group.items.length > ITEM_LIMIT && (
                        <span className="text-muted-foreground"> +{group.items.length - ITEM_LIMIT} more</span>
                      )}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  {displayItems.join(", ")}
                  {remaining > 0 && (
                    <span className="text-muted-foreground"> +{remaining} more</span>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

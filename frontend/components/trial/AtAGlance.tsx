import { Calendar, FlaskConical, MapPin, UserRound, Users } from "lucide-react";
import { formatAge, formatPhase, formatSex } from "@/lib/trials/formatters";
import { parseAgeToYears } from "@/lib/trials/age";
import type { TrialInsights } from "@/components/trial/TrialEnrichments";
import { normalizePossiblyEncodedJson } from "@/lib/trials/json";

const CARD_LIMIT = 6;

type TrialCore = {
  phase?: string | null;
  minimum_age?: string | null;
  maximum_age?: string | null;
  min_age_years?: number | null;
  max_age_years?: number | null;
  gender?: string | null;
  site_count_us?: number | null;
  states_list?: string[] | null;
};

type StructuredSummary = {
  structured?: {
    enrollment?: {
      target?: number | string | null;
      type?: string | null;
    };
    dates?: {
      study_duration_days?: number | string | null;
      study_duration?: number | string | null;
      target_duration?: string | null;
    };
  };
  key_info?: Array<{ label?: string | null; value?: string | null }> | null;
};

function formatDurationFromDays(raw?: number | string | null): string | null {
  if (raw == null) return null;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const days = parsed;
  if (days >= 365) {
    const years = days / 365;
    const rounded = years < 10 ? Math.round(years * 10) / 10 : Math.round(years);
    return `about ${rounded} year${rounded === 1 ? "" : "s"}`;
  }
  if (days >= 60) {
    const months = Math.round(days / 30);
    return `about ${months} month${months === 1 ? "" : "s"}`;
  }
  return `about ${Math.round(days)} day${Math.round(days) === 1 ? "" : "s"}`;
}

function fallbackKeyInfo(summary: StructuredSummary | null, matcher: RegExp): string | null {
  const items = Array.isArray(summary?.key_info) ? summary?.key_info : [];
  const entry = items.find((item) => matcher.test(item?.label ?? ""));
  const value = typeof entry?.value === "string" ? entry.value.trim() : "";
  return value || null;
}

function formatEnrollment(raw?: number | string | null): string | null {
  if (raw == null) return null;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return new Intl.NumberFormat("en-US").format(parsed);
}

function normalizePhaseLabel(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;
  const upper = cleaned.toUpperCase();
  const key = upper.replace(/[\s_-]+/g, "");
  if (["NA", "N/A", "NOTAPPLICABLE"].includes(key)) return null;
  const match = upper.match(/PHASE\s*([0-4])\s*\/\s*PHASE\s*([0-4])/);
  if (match) return `Phase ${match[1]}/${match[2]}`;
  if (upper.startsWith("PHASE")) {
    const normalized = upper.replace(/PHASE\s*/g, "Phase ").replace(/\s+/g, " ").trim();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
  return cleaned;
}

function formatLocations(siteCount?: number | null, states?: string[] | null): string | null {
  const count = typeof siteCount === "number" ? siteCount : null;
  const cleanStates = Array.isArray(states) ? states.filter(Boolean) : [];
  const preview = cleanStates.slice(0, 3).join(", ");
  const suffix = cleanStates.length > 3 ? ` +${cleanStates.length - 3}` : "";

  if (count != null) {
    const base = `${count} site${count === 1 ? "" : "s"}`;
    if (preview) return `${base} in ${preview}${suffix}`;
    return base;
  }

  if (preview) return `Sites in ${preview}${suffix}`;
  return null;
}

function gridClass(count: number): string {
  if (count <= 2) return "grid gap-4 sm:grid-cols-2";
  if (count === 4) return "grid gap-4 sm:grid-cols-2";
  return "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
}

export default function AtAGlance({
  trial,
  insights,
  locationLabel,
}: {
  trial: TrialCore;
  insights: TrialInsights | null | undefined;
  locationLabel?: string | null;
}) {
  const summary = normalizePossiblyEncodedJson<StructuredSummary>(insights?.plain_summary_json);

  const phaseLabel = formatPhase(trial.phase ?? undefined) ??
    normalizePhaseLabel(trial.phase ?? null);

  const minAgeYears =
    typeof trial.min_age_years === "number" ? trial.min_age_years : parseAgeToYears(trial.minimum_age);
  const maxAgeYears =
    typeof trial.max_age_years === "number" ? trial.max_age_years : parseAgeToYears(trial.maximum_age);
  const ageLabel = formatAge(minAgeYears ?? undefined, maxAgeYears ?? undefined);

  const rawSex = typeof trial.gender === "string" ? trial.gender.toLowerCase() : undefined;
  const sexLabel = formatSex(rawSex);

  const enrollmentValue =
    formatEnrollment(summary?.structured?.enrollment?.target) ??
    fallbackKeyInfo(summary, /enrollment|participants|subjects|sample/i);

  const durationLabel =
    formatDurationFromDays(summary?.structured?.dates?.study_duration_days ?? summary?.structured?.dates?.study_duration) ??
    (typeof summary?.structured?.dates?.target_duration === "string"
      ? summary?.structured?.dates?.target_duration
      : null) ??
    fallbackKeyInfo(summary, /study length|study duration|duration/i);

  const locationsLabel = formatLocations(trial.site_count_us, trial.states_list ?? null);

  const cards = [
    { label: "Phase", value: phaseLabel, Icon: FlaskConical },
    { label: "Target enrollment", value: enrollmentValue, Icon: Users },
    { label: "Study length", value: durationLabel, Icon: Calendar },
    { label: "Ages", value: ageLabel, Icon: UserRound },
    { label: "Sex", value: sexLabel, Icon: UserRound },
    { label: "Locations", value: locationLabel ?? locationsLabel, Icon: MapPin },
  ]
    .filter((card) => typeof card.value === "string" && card.value.trim().length > 0)
    .slice(0, CARD_LIMIT);

  if (cards.length === 0) return null;

  return (
    <section className={gridClass(cards.length)}>
      {cards.map(({ label, value, Icon }) => (
        <div
          key={label}
          className="rounded-xl border border-border/40 bg-white/60 p-4 shadow-[0_16px_32px_rgba(15,23,42,0.06)]"
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Icon className="h-4 w-4 text-muted-foreground/70" aria-hidden="true" />
            <span>{label}</span>
          </div>
          <p className="mt-3 text-base font-semibold text-foreground">{value}</p>
        </div>
      ))}
    </section>
  );
}

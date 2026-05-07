const AGE_UNIT_TO_YEARS: Record<string, number> = {
  year: 1,
  years: 1,
  yr: 1,
  yrs: 1,
  month: 1 / 12,
  months: 1 / 12,
  week: 1 / 52,
  weeks: 1 / 52,
  day: 1 / 365,
  days: 1 / 365,
};

const NULL_LIKE = new Set([
  "n/a",
  "na",
  "none",
  "not applicable",
  "unknown",
  "no limit",
  "no limits",
  "not specified",
]);

export function parseAgeToYears(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (NULL_LIKE.has(lower)) return null;

  const numberMatch = lower.match(/(\d+(?:\.\d+)?)/);
  if (!numberMatch) return null;
  const num = Number(numberMatch[1]);
  if (!Number.isFinite(num)) return null;

  const unitMatch = lower.match(
    /\b(year|years|yr|yrs|month|months|week|weeks|day|days)\b/,
  );
  const unit = unitMatch?.[1] ?? "years";
  const factor = AGE_UNIT_TO_YEARS[unit] ?? 1;
  const years = num * factor;
  return Number.isFinite(years) ? years : null;
}

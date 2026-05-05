import { haversineMiles } from "@/lib/geo";
import { toConditionLabel, toConditionSlug } from "@/shared/conditions-normalize";

type SortSpec = {
  column: string;
  ascending: boolean;
  nullsFirst?: boolean;
};

export const DEFAULT_TRIALS_SORT: SortSpec[] = [
  { column: "quality_score", ascending: false, nullsFirst: false },
  { column: "title", ascending: true },
];

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toSortableTitle(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

type ConditionFilterData = {
  rawConditions: string[];
  multiConditions: string[];
  condition: string;
  conditionFilterValues: string[];
};

export function buildConditionFilterData(
  conditionsParam: string | string[] | undefined,
  conditionParam: string | string[] | undefined,
): ConditionFilterData {
  const rawConditions = Array.isArray(conditionsParam)
    ? conditionsParam.flatMap((entry) => String(entry).split(","))
    : typeof conditionsParam === "string"
      ? conditionsParam.split(",")
      : [];

  const multiConditions = Array.from(
    new Set(
      rawConditions
        .map((value) => toConditionSlug(value))
        .filter(Boolean),
    ),
  );

  const rawCondition = typeof conditionParam === "string" ? conditionParam : "";
  const condition = multiConditions[0] || (rawCondition ? toConditionSlug(rawCondition) : "");
  const selectedConditions = multiConditions.length > 0
    ? multiConditions
    : condition
      ? [condition]
      : [];

  const conditionFilters = new Set<string>();
  rawConditions.forEach((value) => {
    const trimmed = String(value ?? "").trim();
    if (trimmed) conditionFilters.add(trimmed);
  });
  if (rawCondition) conditionFilters.add(rawCondition.trim());
  selectedConditions.forEach((value) => {
    const trimmed = value?.trim();
    if (!trimmed) return;
    conditionFilters.add(trimmed);
    conditionFilters.add(toConditionLabel(trimmed));
  });

  const conditionFilterValues = Array.from(conditionFilters).filter(
    (value) => value && value.toLowerCase() !== "other",
  );

  return {
    rawConditions,
    multiConditions,
    condition,
    conditionFilterValues,
  };
}

export function parseStatusBuckets(statusBucketRaw: string): string[] {
  return statusBucketRaw
    ? statusBucketRaw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
    : [];
}

export function applyTrialsSort<Query extends { order: (column: string, options?: Record<string, unknown>) => Query }>(
  query: Query,
  sortSpec: SortSpec[] = DEFAULT_TRIALS_SORT,
): Query {
  return sortSpec.reduce((next, entry) => {
    const options: Record<string, unknown> = {
      ascending: entry.ascending,
    };
    if (entry.nullsFirst !== undefined) {
      options.nullsFirst = entry.nullsFirst;
    }
    return next.order(entry.column, options);
  }, query);
}

export type TrialDistanceSite = {
  nct_id: string;
  lat: number | null;
  lon: number | null;
  city: string | null;
  state_code: string | null;
};

export function applyDistanceToTrials<T extends { nct_id: string }>(
  trials: T[],
  sites: TrialDistanceSite[],
  origin: { lat: number | null; lon: number | null } | null,
) {
  const lat = toNumber(origin?.lat);
  const lon = toNumber(origin?.lon);
  const distanceReady = lat != null && lon != null && sites.length > 0;

  if (!distanceReady) {
    return {
      distanceReady,
      trials: trials.map((trial) => ({
        ...trial,
        distance_miles: null,
        nearest_site_name: null,
      })),
    };
  }

  const nearestByTrial = new Map<string, { distance: number; city: string | null; state: string | null }>();
  sites.forEach((site) => {
    const siteLat = toNumber(site.lat);
    const siteLon = toNumber(site.lon);
    if (siteLat == null || siteLon == null) return;
    const distance = haversineMiles({ lat, lng: lon }, { lat: siteLat, lng: siteLon });
    const existing = nearestByTrial.get(site.nct_id);
    if (!existing || distance < existing.distance) {
      nearestByTrial.set(site.nct_id, {
        distance,
        city: site.city ?? null,
        state: site.state_code ?? null,
      });
    }
  });

  const enriched = trials.map((trial) => {
    const nearest = nearestByTrial.get(trial.nct_id);
    return {
      ...trial,
      distance_miles: nearest ? Number(nearest.distance.toFixed(2)) : null,
      nearest_site_name: nearest
        ? [nearest.city, nearest.state].filter(Boolean).join(", ")
        : null,
    };
  });

  return { distanceReady, trials: enriched };
}

export function sortTrialsByDistance<T extends { distance_miles: number | null }>(trials: T[]): T[] {
  return [...trials].sort((a, b) => {
    const aDistance = toNumber(a.distance_miles);
    const bDistance = toNumber(b.distance_miles);
    if (aDistance == null && bDistance == null) return 0;
    if (aDistance == null) return 1;
    if (bDistance == null) return -1;
    return aDistance - bDistance;
  });
}

export function sortTrialsByQualityScore<T extends { quality_score?: number | null; title?: string | null }>(
  trials: T[],
): T[] {
  return [...trials].sort((a, b) => {
    const aScore = toNumber(a.quality_score);
    const bScore = toNumber(b.quality_score);
    if (aScore == null && bScore == null) {
      const aTitle = toSortableTitle(a.title);
      const bTitle = toSortableTitle(b.title);
      return aTitle.localeCompare(bTitle);
    }
    if (aScore == null) return 1;
    if (bScore == null) return -1;
    if (aScore !== bScore) return bScore - aScore;
    const aTitle = toSortableTitle(a.title);
    const bTitle = toSortableTitle(b.title);
    return aTitle.localeCompare(bTitle);
  });
}

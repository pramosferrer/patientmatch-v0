export const canonicalNctId = (n: string | undefined | null) =>
  (n ? String(n).toUpperCase() : "");

const PROFILE_QUERY_KEYS = ["condition", "zip", "age", "sex", "radius"] as const;

type QueryLike =
  | URLSearchParams
  | { get: (key: string) => string | null }
  | Record<string, string | string[] | number | boolean | null | undefined>
  | null
  | undefined;

function withQuery(
  path: string,
  params?: Record<string, string | number | boolean | null | undefined>,
) {
  if (!params) return path;

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    const normalized = String(value).trim();
    if (!normalized) continue;
    query.set(key, normalized);
  }

  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}

function readQueryValue(source: QueryLike, key: string): string | number | boolean | null | undefined {
  if (!source) return undefined;
  if (typeof URLSearchParams !== "undefined" && source instanceof URLSearchParams) {
    return source.get(key);
  }
  if ("get" in source && typeof source.get === "function") {
    return source.get(key);
  }
  const value = (source as Record<string, string | string[] | number | boolean | null | undefined>)[key];
  return Array.isArray(value) ? value[0] : value;
}

export function trialProfileQueryParams(source: QueryLike) {
  const params: Record<string, string> = {};
  for (const key of PROFILE_QUERY_KEYS) {
    const value = readQueryValue(source, key);
    if (value == null) continue;
    const normalized = String(value).trim();
    if (normalized) params[key] = normalized;
  }
  return params;
}

export const trialHref = (
  trial: { id?: string | number; nct_id?: string },
  params?: Record<string, string | number | boolean | null | undefined>,
) => withQuery(`/trial/${trial.nct_id ?? trial.id ?? ""}`, params);

export const screenerHref = (
  trial: { id?: string | number; nct_id?: string },
  prefill?: Record<string, string | number | boolean | null | undefined>,
) => {
  const nct = trial.nct_id ? canonicalNctId(trial.nct_id as any) : undefined;
  const path =
    nct && nct.length > 0
      ? `/trial/${nct}/screen`
      : trial.id
        ? `/trial/${trial.id}/screen`
        : "/trial//screen";
  return withQuery(path, { mode: "patient", ...prefill });
};

export const trialHrefFromSearch = (
  trial: { id?: string | number; nct_id?: string },
  searchParams: QueryLike,
) => trialHref(trial, trialProfileQueryParams(searchParams));

export const screenerHrefFromSearch = (
  trial: { id?: string | number; nct_id?: string },
  searchParams: QueryLike,
) => screenerHref(trial, trialProfileQueryParams(searchParams));

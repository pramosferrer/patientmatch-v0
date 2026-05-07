export const canonicalNctId = (n: string | undefined | null) =>
  (n ? String(n).toUpperCase() : "");

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

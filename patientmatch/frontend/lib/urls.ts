export const canonicalNctId = (n: string | undefined | null) =>
  (n ? String(n).toUpperCase() : "");

export const trialHref = (trial: { id?: string | number; nct_id?: string }) =>
  `/trial/${trial.nct_id ?? trial.id ?? ""}`;

export const screenerHref = (
  trial: { id?: string | number; nct_id?: string },
  prefill?: Record<string, any>,
) => {
  const nct = trial.nct_id ? canonicalNctId(trial.nct_id as any) : undefined;
  const path =
    nct && nct.length > 0
      ? `/trial/${nct}/screen`
      : trial.id
        ? `/trial/${trial.id}/screen`
        : "/trial//screen";
  const params = new URLSearchParams({ mode: "patient" });
  if (prefill && Object.keys(prefill).length > 0) {
    params.set("prefill", JSON.stringify(prefill));
  }
  return `${path}?${params.toString()}`;
};

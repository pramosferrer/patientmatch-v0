// /frontend/lib/trials/formatters.ts
export function formatAge(ageMin?: number, ageMax?: number) {
  if (ageMin == null && ageMax == null) return "All ages";
  if (ageMin != null && ageMax != null) return `${ageMin}–${ageMax}`;
  if (ageMin != null) return `${ageMin}+`;
  return `≤${ageMax}`;
}

export function formatSex(sex?: "male" | "female" | "all" | string) {
  if (!sex || sex === "all") return null; // omit if open to all
  if (sex.toLowerCase() === "male") return "Male only";
  if (sex.toLowerCase() === "female") return "Female only";
  return null;
}

export function formatDiagnosis(diagnosisRequired?: boolean) {
  if (diagnosisRequired == null) return null;
  return diagnosisRequired ? "Diagnosed" : "Undiagnosed OK";
}

const PHASE_LABELS: Record<string, string> = {
  PHASE1: "Phase 1",
  PHASE2: "Phase 2",
  PHASE3: "Phase 3",
  PHASE4: "Phase 4",
  NA: "NA",
};

export function formatPhase(phase?: string) {
  if (!phase) return null;
  const key = phase.toUpperCase();
  return PHASE_LABELS[key] ?? null;
}

export function formatLocation(
  sites?: Array<{ city?: string; state?: string; country?: string }>,
  siteCount?: number,
  isRemote?: boolean
) {
  if (isRemote) return "Remote / Online";
  const n = siteCount ?? sites?.length ?? 0;
  if (!n) return null;
  if (n === 1 && sites?.[0]) {
    const { city, state, country } = sites[0]!;
    const parts = [city, state, !state && country ? country : undefined].filter(Boolean);
    return parts.join(", ") || "1 site";
  }
  return `Multiple sites • ${n}`;
}

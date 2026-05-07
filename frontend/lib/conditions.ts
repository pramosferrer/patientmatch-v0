import { getServerSupabase } from "./supabaseServer";
import { unstable_cache } from "next/cache";
import { FEATURED_CONDITIONS } from "@/shared/conditions";
import { toConditionLabel } from "@/shared/conditions-normalize";

export type ConditionSuggestion = {
  label: string;
  slug: string;
};

function isSearchableConditionLabel(label: string) {
  return !/\b(freedom from|change in|endpoint|score|stent graft|at \d+\s*(weeks?|months?|years?)|centimeters?)\b/i
    .test(label);
}

/**
 * Fetches condition suggestions from Supabase and merges with local taxonomy.
 * This should be called from the server (e.g. Server Action) to ensure secure/correct API key usage.
 */
/**
 * Fetches condition suggestions from the cached catalog.
 */
async function fetchConditionSuggestions(query: string): Promise<ConditionSuggestion[]> {
  const normalizedQuery = query.toLowerCase().trim();

  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("condition_directory_latest")
      .select("condition_slug, condition_label")
      .ilike("condition_label", `%${normalizedQuery}%`)
      .order("recruiting_count", { ascending: false })
      .limit(10);

    if (!error && Array.isArray(data) && data.length > 0) {
      return data
        .filter((row) => typeof row.condition_slug === "string" && typeof row.condition_label === "string")
        .filter((row) => isSearchableConditionLabel(row.condition_label as string))
        .map((row) => ({
          slug: row.condition_slug as string,
          label: row.condition_label as string,
        }));
    }
  } catch {
    // Fall back to the catalog path when the aggregate view is not deployed yet.
  }

  return FEATURED_CONDITIONS
    .map((slug) => ({ slug, label: toConditionLabel(slug) }))
    .filter((condition) =>
      condition.label.toLowerCase().includes(normalizedQuery) ||
      condition.slug.toLowerCase().includes(normalizedQuery)
    )
    .slice(0, 10);
}

const getConditionSuggestionsCached = unstable_cache(
  fetchConditionSuggestions,
  ["condition-suggestions-v5"],
  {
    revalidate: 300,
    tags: ["conditions"],
  },
);

export async function getConditionSuggestions(query: string): Promise<ConditionSuggestion[]> {
  if (!query || query.length < 2) return [];
  return getConditionSuggestionsCached(query);
}

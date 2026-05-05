import { getServerSupabase } from "./supabaseServer";
import { toConditionLabel, toConditionSlug } from "@/shared/conditions-normalize";

export type ConditionSuggestion = {
  label: string;
  slug: string;
};

/**
 * Fetches condition suggestions from Supabase and merges with local taxonomy.
 * This should be called from the server (e.g. Server Action) to ensure secure/correct API key usage.
 */
/**
 * Fetches condition suggestions from the cached catalog.
 */
export async function getConditionSuggestions(query: string): Promise<ConditionSuggestion[]> {
  if (!query || query.length < 2) return [];

  const { getConditionCatalog } = await import("../shared/conditions.catalog");
  const catalog = await getConditionCatalog();
  const normalizedQuery = query.toLowerCase().trim();

  // Search in labels and synonyms
  const matches = catalog.all.filter(c => 
    c.label.toLowerCase().includes(normalizedQuery) || 
    c.synonyms?.some(s => s.toLowerCase().includes(normalizedQuery))
  );

  return matches.slice(0, 10).map(c => ({
    label: c.label,
    slug: c.slug
  }));
}

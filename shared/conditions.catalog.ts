import { getServerSupabase } from '@/lib/supabaseServer';
import { toConditionLabel, toConditionSlug } from './conditions-normalize';

const isDev = process.env.NODE_ENV !== 'production';
const devLog = (...args: unknown[]) => {
  if (isDev) console.log(...args);
};

// Types
export type ConditionItem = {
  slug: string;
  label: string;
  synonyms?: string[];
  source: 'seed' | 'db';
  count: number;
  lastUpdated?: string | null;
};

export type ConditionCatalog = {
  featured: ConditionItem[];
  all: ConditionItem[];
  filtered: ConditionItem[]; // Items with count >= minCount
  version: string;
};

export type CatalogOptions = {
  includeEmpty?: boolean;
  minCount?: number;
};

export type ConditionDirectoryQueryOptions = {
  query?: string;
  limit?: number;
};

type TrialConditionRow = {
  nct_id: string | null;
  conditions: unknown;
  status_bucket: string | null;
};

type ConditionDirectoryRow = {
  condition_slug: string | null;
  condition_label: string | null;
  recruiting_count: number | null;
  updated_at: string | null;
  source: 'seed' | 'db' | null;
};

const CONDITIONS_PAGE_SIZE = 1000;
const DEFAULT_DIRECTORY_LIMIT = 300;

// Curated seed list with labels and synonyms
const SEED_CONDITIONS: Omit<ConditionItem, 'count' | 'source'>[] = [
  {
    slug: 'long_covid',
    label: 'Long COVID',
    synonyms: ['post-acute sequelae of SARS-CoV-2', 'PASC', 'post covid', 'long haul covid']
  },
  {
    slug: 'fibromyalgia',
    label: 'Fibromyalgia',
    synonyms: ['chronic widespread pain', 'fibromyalgia syndrome']
  },
  {
    slug: 'hidradenitis_suppurativa',
    label: 'Hidradenitis Suppurativa',
    synonyms: ['HS', 'acne inversa', 'hidradenitis']
  },
  {
    slug: 'copd',
    label: 'COPD',
    synonyms: ['chronic obstructive pulmonary disease', 'emphysema', 'chronic bronchitis']
  },
  {
    slug: 'alzheimers_disease',
    label: 'Alzheimer\'s Disease',
    synonyms: ['alzheimer disease', 'AD', 'dementia', 'alzheimers']
  },
  {
    slug: 'type_2_diabetes',
    label: 'Type 2 Diabetes',
    synonyms: ['T2D', 'adult-onset diabetes', 'diabetes mellitus type 2', 'diabetes']
  },
  {
    slug: 'obesity',
    label: 'Obesity',
    synonyms: ['overweight', 'weight management', 'BMI', 'weight loss']
  },
  {
    slug: 'ulcerative_colitis',
    label: 'Ulcerative Colitis',
    synonyms: ['UC', 'inflammatory bowel disease', 'IBD', 'colitis']
  },
  {
    slug: 'atopic_dermatitis',
    label: 'Atopic Dermatitis',
    synonyms: ['eczema', 'atopic eczema', 'dermatitis']
  },
  {
    slug: 'rheumatoid_arthritis',
    label: 'Rheumatoid Arthritis',
    synonyms: ['RA', 'inflammatory arthritis', 'autoimmune arthritis']
  },
  {
    slug: 'parkinsons_disease',
    label: 'Parkinson\'s Disease',
    synonyms: ['parkinson disease', 'PD', 'parkinsons']
  },
  {
    slug: 'masld_mash',
    label: 'MASLD/MASH',
    synonyms: ['NAFLD', 'NASH', 'fatty liver', 'nonalcoholic fatty liver disease', 'nonalcoholic steatohepatitis', 'metabolic dysfunction-associated steatotic liver disease']
  },
  // Extended seed list
  {
    slug: 'migraine',
    label: 'Migraine',
    synonyms: ['migraine disorders', 'chronic migraine', 'headache']
  },
  {
    slug: 'psoriasis',
    label: 'Psoriasis',
    synonyms: ['plaque psoriasis', 'skin psoriasis']
  },
  {
    slug: 'crohns_disease',
    label: 'Crohn\'s Disease',
    synonyms: ['crohn disease', 'inflammatory bowel diseases', 'IBD', 'crohns']
  },
  {
    slug: 'endometriosis',
    label: 'Endometriosis',
    synonyms: ['endometrial implants', 'pelvic endometriosis']
  },
  {
    slug: 'osteoarthritis',
    label: 'Osteoarthritis',
    synonyms: ['knee osteoarthritis', 'hip osteoarthritis', 'OA', 'degenerative arthritis']
  },
  {
    slug: 'asthma',
    label: 'Asthma',
    synonyms: ['severe asthma', 'bronchial asthma', 'allergic asthma']
  },
  {
    slug: 'insomnia',
    label: 'Insomnia',
    synonyms: ['sleep initiation and maintenance disorders', 'sleep disorders', 'sleeplessness']
  },
  {
    slug: 'mdd',
    label: 'Major Depressive Disorder',
    synonyms: ['depressive disorder major', 'major depressive disorder', 'depression', 'MDD']
  },
  {
    slug: 'anxiety',
    label: 'Anxiety',
    synonyms: ['anxiety disorders', 'GAD', 'generalized anxiety disorder']
  },
  {
    slug: 'multiple_sclerosis',
    label: 'Multiple Sclerosis',
    synonyms: ['MS', 'sclerosis']
  },
  {
    slug: 'ibs',
    label: 'Irritable Bowel Syndrome',
    synonyms: ['IBS', 'irritable colon']
  },
  {
    slug: 'type_1_diabetes',
    label: 'Type 1 Diabetes',
    synonyms: ['T1D', 'insulin dependent diabetes']
  }
];

// Featured conditions (order matters for display)
const FEATURED_SLUGS = [
  'long_covid',
  'fibromyalgia',
  'hidradenitis_suppurativa',
  'copd',
  'alzheimers_disease',
  'type_2_diabetes',
  'obesity',
  'ulcerative_colitis',
  'atopic_dermatitis',
  'rheumatoid_arthritis',
  'parkinsons_disease',
  'masld_mash',
  'migraine',
  'crohns_disease'
];

// Convert slug to title case for unknown conditions from DB
function slugToTitleCase(slug: string): string {
  return slug
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Build the overlaps filter values for a seed condition (slug + label + synonym slugs + synonym labels)
function seedFilterValues(seed: Omit<ConditionItem, 'count' | 'source'>): string[] {
  const values = new Set<string>();
  values.add(seed.slug);
  values.add(toConditionLabel(seed.slug));
  for (const syn of seed.synonyms ?? []) {
    const t = syn.trim();
    if (t) {
      values.add(t);
      const s = toConditionSlug(t);
      if (s && s !== 'other') values.add(s);
    }
  }
  return Array.from(values).filter(Boolean);
}

const SEED_MAP = new Map(SEED_CONDITIONS.map((seed) => [seed.slug, seed]));

function buildSeedAliasMap(): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const seed of SEED_CONDITIONS) {
    for (const value of seedFilterValues(seed)) {
      const normalized = toConditionSlug(value);
      if (normalized && normalized !== 'other') aliases.set(normalized, seed.slug);
    }
  }
  return aliases;
}

async function fetchTrialConditionRows(supabase: ReturnType<typeof getServerSupabase>) {
  const rows: TrialConditionRow[] = [];
  for (let from = 0; ; from += CONDITIONS_PAGE_SIZE) {
    const to = from + CONDITIONS_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('trials_serving_latest')
      .select('nct_id, conditions, status_bucket')
      .eq('status_bucket', 'Recruiting')
      .range(from, to);

    if (error) throw error;
    const page = (data ?? []) as TrialConditionRow[];
    rows.push(...page);
    if (page.length < CONDITIONS_PAGE_SIZE) break;
  }
  return rows;
}

async function fetchConditionDirectoryRows(supabase: ReturnType<typeof getServerSupabase>) {
  const rows: ConditionDirectoryRow[] = [];
  for (let from = 0; ; from += CONDITIONS_PAGE_SIZE) {
    const to = from + CONDITIONS_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('condition_directory_latest')
      .select('condition_slug, condition_label, recruiting_count, updated_at, source')
      .order('recruiting_count', { ascending: false })
      .range(from, to);

    if (error) throw error;
    const page = (data ?? []) as ConditionDirectoryRow[];
    rows.push(...page);
    if (page.length < CONDITIONS_PAGE_SIZE) break;
  }
  return rows;
}

function addConditionCount(map: Map<string, number>, slug: string) {
  map.set(slug, (map.get(slug) || 0) + 1);
}

function conditionItemFromDirectoryRow(row: ConditionDirectoryRow): ConditionItem | null {
  if (!row.condition_slug) return null;
  const slug = row.condition_slug;
  const seed = SEED_MAP.get(slug);
  return {
    ...(seed ?? {
      slug,
      label: row.condition_label || toConditionLabel(slug),
    }),
    count: row.recruiting_count ?? 0,
    source: seed ? 'seed' : row.source ?? 'db',
    lastUpdated: row.updated_at,
  };
}

function isPatientFriendlyDirectoryItem(item: ConditionItem) {
  if (FEATURED_SLUGS.includes(item.slug)) return true;
  if (item.count < 5) return false;
  const label = item.label.trim();
  if (label.length < 4) return false;
  if (!/[aeiou]/i.test(label)) return false;
  if (/^\d/.test(label)) return false;
  if (/\b\d+\s*\d*\s*centimeters?\b/i.test(label)) return false;
  return true;
}

function isSearchableConditionItem(item: ConditionItem) {
  if (FEATURED_SLUGS.includes(item.slug)) return true;
  const label = item.label.trim();
  if (label.length < 4) return false;
  if (
    /\b(freedom from|change in|endpoint|score|stent graft|at \d+\s*(weeks?|months?|years?)|centimeters?)\b/i
      .test(label)
  ) {
    return false;
  }
  return true;
}

function fallbackSeedCatalog(): ConditionCatalog {
  const seedItems = SEED_CONDITIONS.map((seed) => ({
    ...seed,
    count: 0,
    source: 'seed' as const,
    lastUpdated: null,
  }));

  return {
    featured: seedItems.filter((item) => FEATURED_SLUGS.includes(item.slug)),
    all: seedItems,
    filtered: seedItems,
    version: new Date().toISOString(),
  };
}

async function queryConditionDirectoryRows({
  query = '',
  limit = DEFAULT_DIRECTORY_LIMIT,
}: ConditionDirectoryQueryOptions = {}) {
  const supabase = getServerSupabase();
  let request = supabase
    .from('condition_directory_latest')
    .select('condition_slug, condition_label, recruiting_count, updated_at, source')
    .order('recruiting_count', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 500));

  const trimmed = query.trim();
  if (trimmed) {
    request = request.ilike('condition_label', `%${trimmed}%`);
  }

  const { data, error } = await request;
  if (error) throw error;
  return (data ?? []) as ConditionDirectoryRow[];
}

export async function getConditionDirectoryPreview(limit = DEFAULT_DIRECTORY_LIMIT): Promise<ConditionCatalog> {
  try {
    const rows = await queryConditionDirectoryRows({ limit });
    const items = rows
      .map(conditionItemFromDirectoryRow)
      .filter((item): item is ConditionItem => Boolean(item))
      .filter(isPatientFriendlyDirectoryItem);

    const bySlug = new Map(items.map((item) => [item.slug, item]));
    for (const seed of SEED_CONDITIONS) {
      if (!bySlug.has(seed.slug)) {
        bySlug.set(seed.slug, {
          ...seed,
          count: 0,
          source: 'seed',
          lastUpdated: null,
        });
      }
    }

    const all = Array.from(bySlug.values()).sort(sortCatalogItems);
    return {
      featured: all.filter((item) => FEATURED_SLUGS.includes(item.slug)),
      all,
      filtered: all,
      version: new Date().toISOString(),
    };
  } catch (error) {
    devLog('Condition directory preview unavailable; using seed-only preview.', error);
    return fallbackSeedCatalog();
  }
}

export async function searchConditionDirectory({
  query = '',
  limit = 50,
}: ConditionDirectoryQueryOptions = {}): Promise<ConditionItem[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    const preview = await getConditionDirectoryPreview(limit);
    return preview.all;
  }

  try {
    const rows = await queryConditionDirectoryRows({ query: trimmed, limit });
    return rows
      .map(conditionItemFromDirectoryRow)
      .filter((item): item is ConditionItem => Boolean(item))
      .filter(isSearchableConditionItem)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  } catch (error) {
    devLog('Condition directory search unavailable; using seed-only search.', error);
    const q = trimmed.toLowerCase();
    return fallbackSeedCatalog().all
      .filter((item) =>
        item.label.toLowerCase().includes(q) ||
        item.slug.toLowerCase().includes(q) ||
        item.synonyms?.some((synonym) => synonym.toLowerCase().includes(q)),
      )
      .slice(0, limit);
  }
}

// Core function to build catalog (cached)
async function buildConditionCatalog(options: CatalogOptions = {}): Promise<ConditionCatalog> {
  const { includeEmpty = true, minCount = 0 } = options;
  devLog('🏗️ Building condition catalog...');

  try {
    const supabase = getServerSupabase();

    try {
      const directoryRows = await fetchConditionDirectoryRows(supabase);
      if (directoryRows.length > 0) {
        const all = directoryRows
          .filter((row) => row.condition_slug && (includeEmpty || (row.recruiting_count ?? 0) > 0))
          .map((row): ConditionItem => {
            const slug = row.condition_slug!;
            const seed = SEED_MAP.get(slug);
            return {
              ...(seed ?? {
                slug,
                label: row.condition_label || toConditionLabel(slug),
              }),
              count: row.recruiting_count ?? 0,
              source: seed ? 'seed' : row.source ?? 'db',
              lastUpdated: row.updated_at,
            };
          });

        all.sort(sortCatalogItems);
        const featured = all.filter(item => FEATURED_SLUGS.includes(item.slug));
        const filtered = all.filter(item =>
          item.count >= minCount || FEATURED_SLUGS.includes(item.slug)
        );

        devLog(`✅ Built catalog from condition_directory_latest: ${all.length} conditions`);
        return {
          featured,
          all,
          filtered,
          version: new Date().toISOString()
        };
      }
    } catch (directoryError) {
      devLog('Condition directory aggregate unavailable; falling back to trial scan.', directoryError);
    }

    const slugCounts = new Map<string, number>();
    const seedAliases = buildSeedAliasMap();
    const rows = await fetchTrialConditionRows(supabase);

    for (const row of rows) {
      if (!Array.isArray(row.conditions)) continue;

      const rowSlugs = new Set<string>();
      for (const rawSlug of row.conditions) {
        const normalized = toConditionSlug(String(rawSlug));
        if (!normalized || normalized === 'other') continue;
        rowSlugs.add(seedAliases.get(normalized) ?? normalized);
      }

      for (const slug of rowSlugs) addConditionCount(slugCounts, slug);
    }

    const all: ConditionItem[] = [];

    for (const [slug, count] of slugCounts.entries()) {
      const seed = SEED_MAP.get(slug);
      if (seed) {
        all.push({
          ...seed,
          count,
          source: 'seed',
          lastUpdated: null
        });
      } else {
        all.push({
          slug,
          label: toConditionLabel(slug),
          count,
          source: 'db',
          lastUpdated: null
        });
      }
    }

    if (includeEmpty) {
      for (const seed of SEED_CONDITIONS) {
        if (!slugCounts.has(seed.slug)) {
          all.push({
            ...seed,
            count: 0,
            source: 'seed',
            lastUpdated: null
          });
        }
      }
    }

    devLog(`📊 Counted ${all.filter(c => c.count > 0).length} active conditions across ${rows.length} recruiting trials`);

    // Sort: Featured first (in seed order), then by trial count (descending)
    all.sort(sortCatalogItems);

    // Extract featured conditions
    const featured = all.filter(item => FEATURED_SLUGS.includes(item.slug));

    // Filter by count threshold (but always include featured)
    const filtered = all.filter(item =>
      item.count >= minCount || FEATURED_SLUGS.includes(item.slug)
    );

    const catalog: ConditionCatalog = {
      featured,
      all,
      filtered,
      version: new Date().toISOString()
    };

    devLog(`✅ Built catalog: ${featured.length} featured, ${all.length} total, ${filtered.length} filtered (minCount: ${minCount})`);

    return catalog;

  } catch (error) {
    console.error('❌ Error building condition catalog:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      raw: error
    });

    return fallbackSeedCatalog();
  }
}

function sortCatalogItems(a: ConditionItem, b: ConditionItem) {
      const aFeatured = FEATURED_SLUGS.indexOf(a.slug);
      const bFeatured = FEATURED_SLUGS.indexOf(b.slug);

      // Both are featured - keep seed order
      if (aFeatured !== -1 && bFeatured !== -1) {
        return aFeatured - bFeatured;
      }
      // Only a is featured - a comes first
      if (aFeatured !== -1) return -1;
      // Only b is featured - b comes first
      if (bFeatured !== -1) return 1;

      // Neither is featured - sort by trial count (descending), then A-Z as tiebreaker
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.label.localeCompare(b.label);
}

export async function getConditionCatalog(): Promise<ConditionCatalog> {
  return buildConditionCatalog();
}

// Backward-compatible cached export name for code that imports it as a value.
export const getConditionCatalogCached = buildConditionCatalog;

// Non-cached version for API routes that need options
export async function getConditionCatalogWithOptions(options: CatalogOptions = {}): Promise<ConditionCatalog> {
  return buildConditionCatalog(options);
}

// Helper to revalidate the catalog (call after backfills) - server only
export async function revalidateConditions() {
  devLog('🔄 Revalidating condition catalog...');
  const { revalidateTag } = await import('next/cache');
  revalidateTag('conditions', 'max');
}

// Helper to get catalog label for a given slug
export async function getCatalogLabel(slug: string): Promise<string> {
  try {
    const catalog = await getConditionCatalog();
    const item = catalog.all.find(c => c.slug === slug);
    return item?.label || slugToTitleCase(slug);
  } catch {
    return slugToTitleCase(slug);
  }
}

// Client-safe version that requires the catalog to be passed in
export function getCatalogLabelSync(slug: string, catalog?: ConditionCatalog): string {
  if (!catalog) return slugToTitleCase(slug);
  const item = catalog.all.find(c => c.slug === slug);
  return item?.label || slugToTitleCase(slug);
}

// Re-export for backwards compatibility
export { FEATURED_SLUGS as FEATURED_CONDITIONS };

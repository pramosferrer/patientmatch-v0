import { unstable_cache } from 'next/cache';
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

// Core function to build catalog (cached)
async function buildConditionCatalog(options: CatalogOptions = {}): Promise<ConditionCatalog> {
  const { includeEmpty = true, minCount = 0 } = options;
  devLog('🏗️ Building condition catalog...');

  try {
    const supabase = getServerSupabase();

    // --- Accurate counts for seed conditions ---
    // Use parallel count-only queries (head:true) with the same overlaps filter as the
    // condition slug page. This bypasses the 1000-row PostgREST cap entirely.
    const seedCountResults = await Promise.all(
      SEED_CONDITIONS.map(async (seed) => {
        const filterValues = seedFilterValues(seed);
        const [{ count: total }, { count: recruiting }] = await Promise.all([
          supabase
            .from('trials_serving_latest')
            .select('nct_id', { count: 'exact', head: true })
            .overlaps('conditions', filterValues),
          supabase
            .from('trials_serving_latest')
            .select('nct_id', { count: 'exact', head: true })
            .overlaps('conditions', filterValues)
            .eq('status_bucket', 'Recruiting'),
        ]);
        return { slug: seed.slug, total: total ?? 0, recruiting: recruiting ?? 0 };
      })
    );

    const slugCounts = new Map<string, number>();
    const recruitingCounts = new Map<string, number>();
    for (const { slug, total, recruiting } of seedCountResults) {
      slugCounts.set(slug, total);
      recruitingCounts.set(slug, recruiting);
    }

    // --- Approximate counts for non-seed DB conditions ---
    // Sample up to 1000 rows (PostgREST default cap) for ranking purposes only.
    const { data: sampleData } = await supabase
      .from('trials_serving_latest')
      .select('conditions, status_bucket');

    const seedSlugSet = new Set(SEED_CONDITIONS.map(s => s.slug));
    let totalTrials = 0;
    let recruitingTrials = 0;

    for (const row of sampleData || []) {
      totalTrials++;
      const isRecruiting = row.status_bucket?.toLowerCase() === 'recruiting';
      if (isRecruiting) recruitingTrials++;

      if (!Array.isArray(row.conditions)) continue;
      for (const rawSlug of row.conditions) {
        const slug = toConditionSlug(String(rawSlug));
        if (!slug || slug === 'other' || seedSlugSet.has(slug)) continue;
        slugCounts.set(slug, (slugCounts.get(slug) || 0) + 1);
        if (isRecruiting) recruitingCounts.set(slug, (recruitingCounts.get(slug) || 0) + 1);
      }
    }

    devLog(`📊 Seed conditions counted via exact queries; ${totalTrials} sampled for non-seed ranking (${recruitingTrials} recruiting in sample)`);

    // Create seed lookup map
    const seedMap = new Map<string, Omit<ConditionItem, 'count' | 'source'>>();
    for (const seed of SEED_CONDITIONS) {
      seedMap.set(seed.slug, seed);
    }

    // Build all conditions array
    const all: ConditionItem[] = [];

    // Add all slugs from database
    for (const [slug, totalCount] of slugCounts.entries()) {
      const recruitingCount = recruitingCounts.get(slug) || 0;
      const seed = seedMap.get(slug);
      if (seed) {
        // Merge with seed data - use recruiting count as primary
        all.push({
          ...seed,
          count: recruitingCount,
          source: 'seed',
          lastUpdated: null
        });
      } else {
        // Unknown slug from DB - auto-label
        all.push({
          slug,
          label: toConditionLabel(slug),
          count: recruitingCount,
          source: 'db',
          lastUpdated: null
        });
      }
    }

    // Add any missing seed conditions with 0 count
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

    // Sort: Featured first (in seed order), then by trial count (descending)
    all.sort((a, b) => {
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
    });

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
    devLog(`🎯 DB-sourced conditions: ${all.filter(c => c.source === 'db').length}`);

    return catalog;

  } catch (error) {
    console.error('❌ Error building condition catalog:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      raw: error
    });

    // Fallback to seed-only catalog
    const fallback = SEED_CONDITIONS.map(seed => ({
      ...seed,
      count: 0,
      source: 'seed' as const,
      lastUpdated: null
    }));

    return {
      featured: fallback.filter(item => FEATURED_SLUGS.includes(item.slug)),
      all: fallback,
      filtered: fallback.filter(item => FEATURED_SLUGS.includes(item.slug)), // Only featured in fallback
      version: new Date().toISOString()
    };
  }
}

async function getActiveReleaseCatalogVersion(): Promise<string> {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('pipeline_releases')
      .select('build_tag, activated_at, updated_at')
      .eq('status', 'active')
      .order('activated_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (error) return 'unknown';
    return [
      data?.build_tag,
      data?.activated_at,
      data?.updated_at,
    ].filter(Boolean).join(':') || 'unknown';
  } catch {
    return 'unknown';
  }
}

// Cached version with 12h revalidation. The active release version is an
// argument so Vercel does not reuse a stale condition catalog after a release flip.
const getConditionCatalogForRelease = unstable_cache(
  async (_activeReleaseVersion: string) => buildConditionCatalog(),
  ['condition-catalog-v5'],
  {
    tags: ['conditions'],
    revalidate: 43200 // 12 hours
  }
);

export async function getConditionCatalog(): Promise<ConditionCatalog> {
  const activeReleaseVersion = await getActiveReleaseCatalogVersion();
  return getConditionCatalogForRelease(activeReleaseVersion);
}

// Backward-compatible cached export name for code that imports it as a value.
export const getConditionCatalogCached = unstable_cache(
  buildConditionCatalog,
  ['condition-catalog-v5-legacy'],
  {
    tags: ['conditions'],
    revalidate: 43200 // 12 hours
  }
);

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

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

// Core function to build catalog (cached)
async function buildConditionCatalog(options: CatalogOptions = {}): Promise<ConditionCatalog> {
  const { includeEmpty = true, minCount = 0 } = options;
  devLog('🏗️ Building condition catalog...');

  try {
    const supabase = getServerSupabase();

    // Query Supabase for distinct slugs and counts
    const { data, error } = await supabase
      .from('trials_serving_latest')
      .select('conditions, status_bucket')
      .limit(50000); // Get more data for accurate counts

    if (error) {
      console.error('❌ Supabase query error:', error);
      throw error;
    }

    // Count occurrences of each slug
    const slugCounts = new Map<string, number>();
    const recruitingCounts = new Map<string, number>();
    let totalTrials = 0;
    let recruitingTrials = 0;

    for (const row of data || []) {
      totalTrials++;
      const isRecruiting = row.status_bucket?.toLowerCase() === 'recruiting';
      if (isRecruiting) recruitingTrials++;

      if (Array.isArray(row.conditions)) {
        for (const rawSlug of row.conditions) {
          const slug = toConditionSlug(String(rawSlug));
          if (slug && slug !== 'other') {
            slugCounts.set(slug, (slugCounts.get(slug) || 0) + 1);
            if (isRecruiting) {
              recruitingCounts.set(slug, (recruitingCounts.get(slug) || 0) + 1);
            }
          }
        }
      }
    }

    devLog(`📊 Found ${slugCounts.size} distinct condition slugs across ${totalTrials} trials (${recruitingTrials} recruiting)`);

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

// Cached version with 12h revalidation
export const getConditionCatalog = unstable_cache(
  buildConditionCatalog,
  ['condition-catalog-v4'],
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

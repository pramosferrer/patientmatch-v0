// Canonical condition normalization utilities (mirrors data_engine/utils/conditions.py)
// Note: Keep this list small-but-useful; extend as we ingest more slugs

import { z } from 'zod';

// Base valid slugs we recognize (snake_case)
export const VALID_SLUGS = new Set<string>([
  'long_covid',
  'fibromyalgia',
  'hidradenitis_suppurativa',
  'obesity',
  'overweight',
  'ulcerative_colitis',
  'alzheimers_disease',
  'type_1_diabetes',
  'type_2_diabetes',
  'parkinsons_disease',
  'atopic_dermatitis',
  'copd',
  'rheumatoid_arthritis',
  'masld_mash',
  'nafld',
  'nash',
  'anxiety',
  'psoriasis',
  'migraine',
  'crohns_disease',
  'endometriosis',
  'osteoarthritis',
  'asthma',
  'insomnia',
  'mdd',
  'multiple_sclerosis',
  'ibs',
  'other',
]);

// Term → slug base map (extendable)
const TERM_TO_SLUG: Record<string, string> = {
  // canonical names
  'long covid': 'long_covid',
  'fibromyalgia': 'fibromyalgia',
  'hidradenitis suppurativa': 'hidradenitis_suppurativa',
  'obesity': 'obesity',
  'overweight': 'overweight',
  'ulcerative colitis': 'ulcerative_colitis',
  "alzheimer's disease": 'alzheimers_disease',
  'alzheimer’s disease': 'alzheimers_disease',
  'parkinson’s disease': 'parkinsons_disease',
  "parkinson's disease": 'parkinsons_disease',
  'atopic dermatitis': 'atopic_dermatitis',
  'copd': 'copd',
  'chronic obstructive pulmonary disease': 'copd',
  'rheumatoid arthritis': 'rheumatoid_arthritis',
  // fatty liver cluster → project canon
  'nafld': 'nafld',
  'nash': 'nash',
  'masld': 'masld_mash',
  'mash': 'masld_mash',
  'metabolic dysfunction-associated steatotic liver disease': 'masld_mash',
  // Mental Health
  'anxiety': 'anxiety',
  'generalized anxiety disorder': 'anxiety',
  'gad': 'anxiety',
  'depression': 'mdd',
  'major depressive disorder': 'mdd',
  // Dermatology
  'psoriasis': 'psoriasis',
  'plaque psoriasis': 'psoriasis',
  // Neurology
  'migraine': 'migraine',
  'chronic migraine': 'migraine',
  'episodic migraine': 'migraine',
  'multiple sclerosis': 'multiple_sclerosis',
  'ms': 'multiple_sclerosis',
  // GI
  'crohn\'s disease': 'crohns_disease',
  'crohn disease': 'crohns_disease',
  'endometriosis': 'endometriosis',
  'irritable bowel syndrome': 'ibs',
  'ibs': 'ibs',
  // Other
  'osteoarthritis': 'osteoarthritis',
  'asthma': 'asthma',
  'insomnia': 'insomnia',
};

// Extra aliases
const ALIASES: Record<string, string> = {
  // Diabetes T2
  'type 2 diabetes': 'type_2_diabetes',
  'type ii diabetes': 'type_2_diabetes',
  't2dm': 'type_2_diabetes',
  'adult-onset diabetes': 'type_2_diabetes',
  'non insulin dependent diabetes': 'type_2_diabetes',
  'niddm': 'type_2_diabetes',
  // Diabetes T1
  'type 1 diabetes': 'type_1_diabetes',
  'type i diabetes': 'type_1_diabetes',
  't1dm': 'type_1_diabetes',
  // COPD
  'chronic obstructive pulmonary disease': 'copd',
  // Hypertension (example kept for future)
  'hbp': 'hypertension',
  'high blood pressure': 'hypertension',
  'htn': 'hypertension',
};

// Extended synonyms list
const NORMALIZED: Record<string, string[]> = {
  masld_mash: ['masld', 'mash', 'nafld', 'nash'],
  copd: [
    'copd',
    'chronic obstructive pulmonary disease',
    'chronic_obstructive_pulmonary_disease',
    'copd_chronic_obstructive_pulmonary_disease',
  ],
  obesity: ['overweight', 'obesity_and_obesity_related_medical_conditions'],
  overweight: ['obesity', 'obesity_and_obesity_related_medical_conditions'],
  obesity_and_obesity_related_medical_conditions: ['obesity', 'overweight'],
};

// Build extended map
const TERM_TO_SLUG_EXTENDED: Record<string, string> = { ...TERM_TO_SLUG };
for (const [slug, terms] of Object.entries(NORMALIZED)) {
  for (const t of terms) TERM_TO_SLUG_EXTENDED[t.toLowerCase()] = slug;
}

export function expandConditionSlug(slug: string): string[] {
  const base = toConditionSlug(slug);
  if (NORMALIZED[base]) {
    return [base, ...NORMALIZED[base]];
  }
  return [base];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\+\-/'"]+/)
    .filter(Boolean);
}

// Titleize a slug for display
export function toConditionLabel(slug: string): string {
  // Try exact match in our shared CONDITIONS taxonomy first
  const { CONDITIONS } = require('./conditions');
  const found = (CONDITIONS as any[]).find((c: any) => c.slug === slug);
  if (found) return found.label;

  // Fallback map for common outliers or legacy
  const map: Record<string, string> = {
    long_covid: 'Long COVID',
    masld_mash: 'MASLD/MASH',
    nafld: 'NAFLD',
    nash: 'NASH',
    other: 'Other',
  };
  if (map[slug]) return map[slug];

  // Default: Title Case the slug
  return slug
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

export function toConditionSlug(input: string | null | undefined): string {
  if (!input) return 'other';
  const raw = String(input).trim().toLowerCase();
  if (!raw) return 'other';

  // clean punctuation
  const cleaned = raw.replace(/[()\[\].,;:]+/g, ' ').replace(/\s+/g, ' ').trim();

  // direct alias
  if (ALIASES[cleaned]) return ALIASES[cleaned];
  // exact lookup
  if (TERM_TO_SLUG_EXTENDED[cleaned]) return TERM_TO_SLUG_EXTENDED[cleaned];

  const toks = tokenize(cleaned);
  const joined = toks.join(' ');

  // diabetes patterns
  if (/(^|\b)(type\s*2|type\s*ii|t2|t2dm)(\b|$).*\b(diabetes|dm)\b/.test(joined)) return 'type_2_diabetes';
  if (/(^|\b)(type\s*1|type\s*i|t1|t1dm)(\b|$).*\b(diabetes|dm)\b/.test(joined)) return 'type_1_diabetes';

  // token-wise fallback
  for (const [term, slug] of Object.entries(TERM_TO_SLUG_EXTENDED)) {
    if (term && joined.includes(term)) return slug;
  }

  // already a valid slug
  if (VALID_SLUGS.has(cleaned)) return cleaned;

  // Final fallback: slugify the cleaned input
  return cleaned.replace(/\s+/g, '_');
}

export function normalizeConditionList(raw: string[] | null | undefined): { slug: string; label: string }[] {
  const set = new Set<string>();
  for (const item of raw || []) {
    const s = toConditionSlug(item);
    if (s) set.add(s);
  }
  const arr = Array.from(set);
  arr.sort((a, b) => toConditionLabel(a).localeCompare(toConditionLabel(b)));
  return arr.map((slug) => ({ slug, label: toConditionLabel(slug) }));
}

// Quick unit-ish checks (can be executed in node)
export function __selfTest() {
  const samples: Array<[string, string]> = [
    ['Type II Diabetes', 'type_2_diabetes'],
    ['t2dm', 'type_2_diabetes'],
    ['adult-onset diabetes', 'type_2_diabetes'],
    ['Chronic obstructive pulmonary disease', 'copd'],
    ['unknown thing', 'other'],
  ];
  return samples.map(([inp, expected]) => ({ inp, out: toConditionSlug(inp), expected }));
}

export type ConditionOption = { slug: string; label: string; synonyms?: string[] };



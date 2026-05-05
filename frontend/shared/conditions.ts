import { getServerSupabase } from '@/lib/supabaseServer';
import { toConditionLabel, toConditionSlug, type ConditionOption } from './conditions-normalize';

export const FEATURED_CONDITIONS: string[] = [
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

export function conditionSort(a: ConditionOption, b: ConditionOption): number {
  const ai = FEATURED_CONDITIONS.indexOf(a.slug);
  const bi = FEATURED_CONDITIONS.indexOf(b.slug);
  if (ai !== -1 && bi !== -1) return ai - bi;
  if (ai !== -1) return -1;
  if (bi !== -1) return 1;
  return a.label.localeCompare(b.label);
}

// Build once per request (server) using ISR at call sites
export async function fetchAllConditions(): Promise<ConditionOption[]> {
  try {
    const { getConditionCatalog } = await import('./conditions.catalog');
    const catalog = await getConditionCatalog();

    // Convert catalog items to ConditionOption format
    const arr = catalog.all.map((item) => ({
      slug: item.slug,
      label: item.label
    }));

    // Catalog is already sorted by featured and A-Z
    return arr;
  } catch (error) {
    console.error("Error fetching conditions from catalog:", error);
    // Fallback to minimal list
    const arr = FEATURED_CONDITIONS.map((slug) => ({
      slug,
      label: toConditionLabel(slug)
    }));
    return arr;
  }
}

export type Condition = { slug: ConditionSlug; label: string };
export const CONDITIONS = [
  { slug: 'long_covid', label: 'Long COVID' },
  { slug: 'fibromyalgia', label: 'Fibromyalgia' },
  { slug: 'hidradenitis_suppurativa', label: 'Hidradenitis Suppurativa' },
  { slug: 'obesity', label: 'Obesity' },
  { slug: 'overweight', label: 'Overweight' },
  { slug: 'ulcerative_colitis', label: 'Ulcerative Colitis' },
  { slug: 'alzheimers_disease', label: "Alzheimer's Disease" },
  { slug: 'type_1_diabetes', label: 'Type 1 Diabetes' },
  { slug: 'type_2_diabetes', label: 'Type 2 Diabetes' },
  { slug: 'parkinsons_disease', label: "Parkinson's Disease" },
  { slug: 'atopic_dermatitis', label: 'Atopic Dermatitis' },
  { slug: 'copd', label: 'COPD' },
  { slug: 'rheumatoid_arthritis', label: 'Rheumatoid Arthritis' },
  { slug: 'masld_mash', label: 'MASLD/MASH' },
  { slug: 'nafld', label: 'NAFLD' },
  { slug: 'nash', label: 'NASH' },
  { slug: 'anxiety', label: 'Anxiety' },
  { slug: 'psoriasis', label: 'Psoriasis' },
  { slug: 'migraine', label: 'Migraine' },
  { slug: 'crohns_disease', label: "Crohn's Disease" },
  { slug: 'endometriosis', label: 'Endometriosis' },
  { slug: 'osteoarthritis', label: 'Osteoarthritis' },
  { slug: 'asthma', label: 'Asthma' },
  { slug: 'insomnia', label: 'Insomnia' },
  { slug: 'mdd', label: 'Major Depressive Disorder' },
  { slug: 'multiple_sclerosis', label: 'Multiple Sclerosis' },
  { slug: 'ibs', label: 'Irritable Bowel Syndrome' },
] as const;
export type ConditionSlug = (typeof CONDITIONS)[number]['slug'];
export const CONDITION_SLUGS: readonly ConditionSlug[] = CONDITIONS.map(c => c.slug);
export const labelForCondition = (slug: string) =>
  CONDITIONS.find(c => c.slug === slug)?.label ?? slug;

export const CONDITION_DETAILS: Record<string, { description: string; trialTypes: string[]; interventions: string[] }> = {
  long_covid: {
    description: "Ongoing symptoms weeks or months after COVID-19 infection, such as fatigue, brain fog, and shortness of breath.",
    trialTypes: ["New medications", "Rehabilitation programs", "Digital health tools"],
    interventions: ["Anti-inflammatory drugs", "Breathing exercises", "Cognitive therapy"],
  },
  fibromyalgia: {
    description: "A chronic pain condition causing widespread muscle pain, fatigue, and sleep problems.",
    trialTypes: ["New pain medications", "Non-drug therapies", "Lifestyle programs"],
    interventions: ["Nerve pain medications", "Physical therapy", "Mind-body techniques"],
  },
  hidradenitis_suppurativa: {
    description: "A long-term skin condition causing painful lumps and abscesses, often in skin folds.",
    trialTypes: ["Biologic medications", "Surgical treatments", "Wound care studies"],
    interventions: ["Anti-TNF biologics", "Laser therapy", "Antibiotics"],
  },
  obesity: {
    description: "Excess body fat affecting health, linked to conditions like diabetes and heart disease.",
    trialTypes: ["Weight-loss medications", "Lifestyle programs", "Surgical approaches"],
    interventions: ["GLP-1 receptor agonists", "Diet and exercise programs", "Bariatric surgery"],
  },
  ulcerative_colitis: {
    description: "Inflammatory bowel disease causing long-lasting inflammation and ulcers in the colon.",
    trialTypes: ["Biologic drugs", "Anti-inflammatory therapies", "Microbiome treatments"],
    interventions: ["Monoclonal antibodies", "5-ASA drugs", "Fecal microbiota transplant"],
  },
  alzheimers_disease: {
    description: "A progressive brain disorder affecting memory, thinking, and behavior.",
    trialTypes: ["Disease-modifying drugs", "Cognitive therapy", "Digital monitoring"],
    interventions: ["Amyloid-targeting drugs", "Memory training", "Wearable devices"],
  },
  type_2_diabetes: {
    description: "A condition affecting how your body processes blood sugar (glucose).",
    trialTypes: ["New diabetes drugs", "Lifestyle interventions", "Device-based monitoring"],
    interventions: ["SGLT2 inhibitors", "Diet changes", "Continuous glucose monitors"],
  },
  parkinsons_disease: {
    description: "A nervous system disorder affecting movement, often including tremors.",
    trialTypes: ["New medications", "Neuroprotective therapies", "Rehabilitation programs"],
    interventions: ["Dopamine agonists", "Deep brain stimulation", "Exercise programs"],
  },
  atopic_dermatitis: {
    description: "A chronic, inflammatory skin condition causing intense itching, redness, and dry skin, often starting in childhood.",
    trialTypes: ["Biologic drugs", "Topical treatments", "Oral medications"],
    interventions: ["Dupilumab", "JAK inhibitors", "Corticosteroids"],
  },
  copd: {
    description: "A group of lung diseases that block airflow and make breathing difficult, including emphysema and chronic bronchitis.",
    trialTypes: ["Bronchodilators", "Anti-inflammatory studies", "Pulmonary rehab"],
    interventions: ["Inhalers", "Oxygen therapy", "Breathing exercises"],
  },
  rheumatoid_arthritis: {
    description: "An autoimmune and inflammatory disease where your immune system attacks healthy cells in your joints, causing painful swelling.",
    trialTypes: ["Biologic therapies", "DMARD studies", "Pain management"],
    interventions: ["TNF inhibitors", "Methotrexate", "Joint exercises"],
  },
  masld_mash: {
    description: "Metabolic dysfunction-associated steatotic liver disease, formerly known as NAFLD/NASH, involving fat buildup in the liver.",
    trialTypes: ["Weight-loss drugs", "Liver health studies", "Metabolic therapies"],
    interventions: ["GLP-1 agonists", "Dietary interventions", "Vitamin E"],
  },
  nafld: {
    description: "Nonalcoholic fatty liver disease, involving excess fat stored in liver cells not caused by heavy alcohol use.",
    trialTypes: ["Lifestyle modification", "Supplements", "Early-stage drugs"],
    interventions: ["Weight loss", "Vitamin E", "Metformin"],
  },
  nash: {
    description: "Nonalcoholic steatohepatitis, a more severe form of NAFLD where liver fat causes inflammation and damage.",
    trialTypes: ["Anti-fibrotic agents", "Metabolic drugs", "Clinical trials for cirrhosis"],
    interventions: ["Resmetirom", "Semaglutide", "Pioglitazone"],
  },
  anxiety: {
    description: "Persistent, excessive worry that interferes with daily activities, including GAD and panic disorders.",
    trialTypes: ["Psychotherapy", "Pharmacology", "Digital interventions"],
    interventions: ["CBT", "SSRIs", "Mindfulness apps"],
  },
  psoriasis: {
    description: "An autoimmune skin condition that speeds up the life cycle of skin cells, causing scales and itchy red patches.",
    trialTypes: ["Biologics", "Topical studies", "Systemic therapies"],
    interventions: ["IL-17 inhibitors", "UV therapy", "Retinoids"],
  },
  migraine: {
    description: "A neurological condition that can cause multiple symptoms, most notably intense, debilitating headaches.",
    trialTypes: ["Preventive drugs", "Acute treatments", "Device studies"],
    interventions: ["CGRP inhibitors", "Triptans", "Neuromodulation"],
  },
  crohns_disease: {
    description: "A type of inflammatory bowel disease (IBD) that causes inflammation of your digestive tract.",
    trialTypes: ["New biologics", "Targeted small molecules", "Dietary trials"],
    interventions: ["Infliximab", "Adalimumab", "Specialized diets"],
  },
  endometriosis: {
    description: "A painful disorder in which tissue similar to the tissue that normally lines the inside of your uterus grows outside your uterus.",
    trialTypes: ["Hormone therapies", "Pain management", "Surgical techniques"],
    interventions: ["GnRH agonists", "Oral contraceptives", "Laparoscopy"],
  },
  osteoarthritis: {
    description: "The most common form of arthritis, occurring when the protective cartilage that cushions the ends of the bones wears down over time.",
    trialTypes: ["Pain relief studies", "Cartilage repair", "Physical therapy"],
    interventions: ["NSAIDs", "Hyaluronic acid injections", "Knee/hip exercises"],
  },
  asthma: {
    description: "A condition in which your airways narrow and swell and may produce extra mucus, making breathing difficult.",
    trialTypes: ["Biologic treatments", "New inhaler tech", "Environmental triggers"],
    interventions: ["Mepolizumab", "Combination inhalers", "Bronchial thermoplasty"],
  },
  insomnia: {
    description: "A common sleep disorder that can make it hard to fall asleep, hard to stay asleep, or cause you to wake up too early.",
    trialTypes: ["Sleep hygiene", "New sedatives", "Cognitive therapy"],
    interventions: ["CBT-I", "Melatonin receptor agonists", "Orexin antagonists"],
  },
  mdd: {
    description: "A mental health disorder characterized by persistently depressed mood or loss of interest in activities.",
    trialTypes: ["Transcranial stimulation", "New antidepressants", "Ketamine studies"],
    interventions: ["TMS", "Esketamine", "Psychotherapy"],
  },
  multiple_sclerosis: {
    description: "A disease in which the immune system eats away at the protective covering of nerves.",
    trialTypes: ["Disease-modifying drugs", "Stem cell research", "Mobility studies"],
    interventions: ["Ocrelizumab", "Interferon beta", "Physical therapy"],
  },
  ibs: {
    description: "An intestinal disorder causing pain in the belly, gas, diarrhea, and constipation.",
    trialTypes: ["Microbiome studies", "Dietary changes", "Stress management"],
    interventions: ["Low FODMAP diet", "Probiotics", "Antispasmodics"],
  },
  overweight: {
    description: "Having more body fat than is optimally healthy, often measured by a BMI between 25 and 29.9.",
    trialTypes: ["Metabolic health", "Lifestyle interventions", "Nutritional studies"],
    interventions: ["Exercise programs", "Meal replacement", "Behavioral therapy"],
  },
  type_1_diabetes: {
    description: "A chronic condition in which the pancreas produces little or no insulin.",
    trialTypes: ["Artificial pancreas", "Immunotherapies", "Glucose monitoring"],
    interventions: ["Insulin pumps", "Continuous glucose monitors", "Islet cell transplant"],
  },
  other: {
    description: "Any condition not listed here — search all available trials.",
    trialTypes: ["Varies"],
    interventions: ["Varies"],
  },
};


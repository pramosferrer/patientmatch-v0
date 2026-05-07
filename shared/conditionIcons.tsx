import {
  Heart,
  Brain,
  Bone,
  Wind, // Use Wind for respiratory (no Lungs icon in lucide)
  Activity,
  Droplets,
  Eye,
  Ear,
  Syringe,
  Dna,
  Microscope,
  ShieldCheck,
  Zap,
  Moon,
  type LucideIcon
} from 'lucide-react';

/**
 * Condition Icon Mapping
 *
 * Maps condition slugs/keywords to appropriate Lucide icons.
 * Icons are chosen for ACCURACY, not decoration:
 * - Heart for cardiovascular
 * - Brain for neurological
 * - Lungs for respiratory
 * - etc.
 *
 * When no specific match, returns null (don't show a random icon)
 */

type IconConfig = {
  icon: LucideIcon;
  colorClass: string; // Semantic color class
};

// Keyword patterns mapped to icons
const CONDITION_PATTERNS: Array<{ patterns: string[]; config: IconConfig }> = [
  // Cardiovascular
  {
    patterns: ['heart', 'cardiac', 'cardiovascular', 'hypertension', 'blood pressure', 'coronary', 'atrial', 'ventricular', 'arrhythmia', 'heart failure'],
    config: { icon: Heart, colorClass: 'text-red-500' }
  },
  // Neurological
  {
    patterns: ['alzheimer', 'parkinson', 'dementia', 'brain', 'neurolog', 'epilepsy', 'seizure', 'stroke', 'multiple sclerosis', 'ms ', 'migraine', 'headache', 'neuropath'],
    config: { icon: Brain, colorClass: 'text-purple-500' }
  },
  // Respiratory
  {
    patterns: ['lung', 'pulmonary', 'copd', 'asthma', 'respiratory', 'bronch', 'pneumonia', 'fibrosis', 'emphysema', 'breathing'],
    config: { icon: Wind, colorClass: 'text-sky-500' }
  },
  // Musculoskeletal
  {
    patterns: ['arthritis', 'osteo', 'bone', 'joint', 'musculo', 'rheumat', 'fibromyalgia', 'spine', 'back pain', 'skeletal'],
    config: { icon: Bone, colorClass: 'text-amber-600' }
  },
  // Metabolic/Endocrine
  {
    patterns: ['diabetes', 'thyroid', 'metabolic', 'obesity', 'weight', 'insulin', 'glucose', 'endocrine', 'hormone'],
    config: { icon: Activity, colorClass: 'text-orange-500' }
  },
  // Hematology/Blood
  {
    patterns: ['blood', 'anemia', 'leukemia', 'lymphoma', 'hemophilia', 'platelet', 'clot', 'transfusion', 'hematol'],
    config: { icon: Droplets, colorClass: 'text-red-600' }
  },
  // Ophthalmology
  {
    patterns: ['eye', 'vision', 'ophthalm', 'retina', 'glaucoma', 'macular', 'cataract', 'blind'],
    config: { icon: Eye, colorClass: 'text-blue-500' }
  },
  // ENT/Hearing
  {
    patterns: ['ear', 'hearing', 'deaf', 'tinnitus', 'auditory', 'cochlear'],
    config: { icon: Ear, colorClass: 'text-indigo-500' }
  },
  // Oncology (general)
  {
    patterns: ['cancer', 'tumor', 'oncol', 'carcinoma', 'melanoma', 'sarcoma', 'malignant', 'metasta'],
    config: { icon: Microscope, colorClass: 'text-pink-600' }
  },
  // Immunology/Autoimmune
  {
    patterns: ['immune', 'autoimmune', 'lupus', 'crohn', 'colitis', 'psoriasis', 'eczema', 'dermatitis', 'allerg'],
    config: { icon: ShieldCheck, colorClass: 'text-teal-500' }
  },
  // Genetics/Rare diseases
  {
    patterns: ['genetic', 'gene ', 'dna', 'rare disease', 'inherited', 'congenital', 'syndrome'],
    config: { icon: Dna, colorClass: 'text-violet-500' }
  },
  // Infectious disease
  {
    patterns: ['covid', 'viral', 'bacterial', 'infection', 'hiv', 'hepatitis', 'tuberculosis', 'influenza', 'vaccine'],
    config: { icon: Syringe, colorClass: 'text-emerald-500' }
  },
  // Mental health
  {
    patterns: ['depression', 'anxiety', 'bipolar', 'schizophrenia', 'mental health', 'psychiatric', 'ptsd', 'adhd', 'autism'],
    config: { icon: Moon, colorClass: 'text-indigo-400' }
  },
  // Sleep
  {
    patterns: ['sleep', 'insomnia', 'apnea', 'narcolepsy', 'circadian'],
    config: { icon: Moon, colorClass: 'text-slate-500' }
  },
  // Pain
  {
    patterns: ['pain', 'chronic pain', 'neuropathic pain', 'analgesic'],
    config: { icon: Zap, colorClass: 'text-yellow-500' }
  },
  // General/Healthy volunteer
  {
    patterns: ['healthy volunteer', 'healthy adult', 'normal subject'],
    config: { icon: Activity, colorClass: 'text-emerald-400' }
  }
];

/**
 * Get icon configuration for a condition
 * Returns null if no appropriate icon found (don't show random icons)
 */
export function getConditionIcon(conditionSlugOrLabel: string): IconConfig | null {
  const normalized = conditionSlugOrLabel.toLowerCase().replace(/_/g, ' ');

  for (const { patterns, config } of CONDITION_PATTERNS) {
    for (const pattern of patterns) {
      if (normalized.includes(pattern)) {
        return config;
      }
    }
  }

  return null;
}

/**
 * React component for rendering condition icon
 */
export function ConditionIcon({
  condition,
  size = 16,
  className = ''
}: {
  condition: string;
  size?: number;
  className?: string;
}) {
  const config = getConditionIcon(condition);

  if (!config) return null;

  const Icon = config.icon;
  return <Icon size={size} className={`${config.colorClass} ${className}`} />;
}

/**
 * Get a simple category label for grouping
 */
export function getConditionCategory(conditionSlugOrLabel: string): string | null {
  const normalized = conditionSlugOrLabel.toLowerCase().replace(/_/g, ' ');

  const categories: Array<{ patterns: string[]; category: string }> = [
    { patterns: ['heart', 'cardiac', 'cardiovascular'], category: 'Cardiovascular' },
    { patterns: ['alzheimer', 'parkinson', 'brain', 'neurolog'], category: 'Neurological' },
    { patterns: ['lung', 'pulmonary', 'copd', 'asthma', 'respiratory'], category: 'Respiratory' },
    { patterns: ['cancer', 'tumor', 'oncol', 'carcinoma'], category: 'Oncology' },
    { patterns: ['diabetes', 'obesity', 'metabolic'], category: 'Metabolic' },
    { patterns: ['arthritis', 'bone', 'joint', 'rheumat'], category: 'Musculoskeletal' },
    { patterns: ['immune', 'autoimmune', 'lupus', 'crohn'], category: 'Immunology' },
    { patterns: ['depression', 'anxiety', 'psychiatric', 'mental'], category: 'Mental Health' },
  ];

  for (const { patterns, category } of categories) {
    for (const pattern of patterns) {
      if (normalized.includes(pattern)) {
        return category;
      }
    }
  }

  return null;
}

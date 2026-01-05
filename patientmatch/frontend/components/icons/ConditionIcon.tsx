import * as React from 'react';
import {
  Activity,
  Brain,
  Droplet,
  FlaskConical,
  Flame,
  HeartPulse,
  Pill,
  Waves,
  Bone,
  ClipboardList,
  Stethoscope,
  Wind,
  Microscope,
  Baby,
  Eye,
  Ear,
  Smile,
  Zap,
  Dna,
  Syringe,
  Thermometer
} from 'lucide-react';

type Props = { slug: string; className?: string };

// 1. Explicit Icon Mappings for known top conditions
const ICONS: Record<string, React.ComponentType<any>> = {
  long_covid: Stethoscope,
  fibromyalgia: Waves,
  hidradenitis_suppurativa: Flame,
  obesity: HeartPulse,
  ulcerative_colitis: FlaskConical,
  alzheimers_disease: Brain,
  type_2_diabetes: Droplet,
  parkinsons_disease: Activity,
  atopic_dermatitis: Pill,
  copd: Wind,
  rheumatoid_arthritis: Bone,
  multiple_sclerosis: Brain,
  breast_cancer: Microscope,
  lymphoma: Dna,
  major_depressive_disorder: Smile, // or Brain
  lung_cancer: Wind,
};

// 2. Keyword fallback for icons
function getIconByKeyword(slug: string) {
  const s = slug.toLowerCase();
  if (s.includes('cancer') || s.includes('tumor') || s.includes('oncology')) return Microscope;
  if (s.includes('heart') || s.includes('cardio') || s.includes('artery')) return HeartPulse;
  if (s.includes('brain') || s.includes('neuro') || s.includes('mental') || s.includes('depress') || s.includes('sclerosis')) return Brain;
  if (s.includes('lung') || s.includes('breath') || s.includes('respiratory')) return Wind;
  if (s.includes('immu') || s.includes('lupus') || s.includes('arthritis')) return Bone;
  if (s.includes('skin') || s.includes('dermat') || s.includes('psoriasis')) return Droplet;
  if (s.includes('child') || s.includes('pediatric')) return Baby;
  if (s.includes('eye') || s.includes('vision') || s.includes('ocular')) return Eye;
  if (s.includes('diabetes') || s.includes('insulin')) return Syringe;
  if (s.includes('infect') || s.includes('viral')) return Thermometer;

  return ClipboardList;
}

// 3. Color Palette Definitions
const PALETTES = [
  { bg: 'bg-indigo-50', text: 'text-indigo-700', ring: 'ring-indigo-200', border: 'border-t-indigo-500' }, // Indigo
  { bg: 'bg-rose-50', text: 'text-rose-700', ring: 'ring-rose-200', border: 'border-t-rose-500' },   // Rose
  { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', border: 'border-t-emerald-500' }, // Emerald
  { bg: 'bg-sky-50', text: 'text-sky-700', ring: 'ring-sky-200', border: 'border-t-sky-500' },     // Sky
  { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', border: 'border-t-amber-500' },   // Amber
  { bg: 'bg-violet-50', text: 'text-violet-700', ring: 'ring-violet-200', border: 'border-t-violet-500' }, // Violet
  { bg: 'bg-cyan-50', text: 'text-cyan-700', ring: 'ring-cyan-200', border: 'border-t-cyan-500' },    // Cyan
  { bg: 'bg-pink-50', text: 'text-pink-700', ring: 'ring-pink-200', border: 'border-t-pink-500' },    // Pink
  { bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-200', border: 'border-t-orange-500' },  // Orange
  { bg: 'bg-teal-50', text: 'text-teal-700', ring: 'ring-teal-200', border: 'border-t-teal-500' },    // Teal
  { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', ring: 'ring-fuchsia-200', border: 'border-t-fuchsia-500' }, // Fuchsia
  { bg: 'bg-lime-50', text: 'text-lime-700', ring: 'ring-lime-200', border: 'border-t-lime-500' },    // Lime
];

// 4. Deterministic Hash Function
function getPaletteIndex(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = slug.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % PALETTES.length;
}

// 5. Explicit Style Overrides (Optional, for brand consistency on top items)
const EXPLICIT_STYLES: Record<string, typeof PALETTES[0]> = {
  long_covid: PALETTES[0], // Indigo
  breast_cancer: PALETTES[7], // Pink
  type_2_diabetes: PALETTES[3], // Sky
  obesity: PALETTES[2], // Emerald
};

export function ConditionIcon({ slug, className }: Props) {
  let Icon = ICONS[slug];
  if (!Icon) {
    Icon = getIconByKeyword(slug);
  }

  return <Icon className={className ?? 'h-6 w-6'} aria-hidden="true" />;
}

export function getConditionStyles(slug: string) {
  // Return explicit style if exists
  if (EXPLICIT_STYLES[slug]) {
    return EXPLICIT_STYLES[slug];
  }

  // Otherwise generate deterministic color
  const index = getPaletteIndex(slug);
  return PALETTES[index];
}

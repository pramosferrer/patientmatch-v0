// /frontend/shared/conditionMeta.ts
import React from "react";
import {
  Stethoscope, Activity, Flame, Thermometer, Microscope,
  Brain, Syringe, Wind, Sparkles, HeartPulse, AlertCircle
} from "lucide-react";

export const LABELS: Record<string, string> = {
  long_covid: "Long COVID",
  fibromyalgia: "Fibromyalgia",
  hidradenitis_suppurativa: "Hidradenitis Suppurativa",
  obesity: "Obesity",
  ulcerative_colitis: "Ulcerative Colitis",
  alzheimers_disease: "Alzheimer's Disease",
  type_2_diabetes: "Type 2 Diabetes",
  parkinsons_disease: "Parkinson's Disease",
  atopic_dermatitis: "Atopic Dermatitis",
  copd: "COPD",
  rheumatoid_arthritis: "Rheumatoid Arthritis",
};

export function labelFromSlug(slug?: string | null) {
  if (!slug) return "";
  return LABELS[slug] ?? slug.replace(/_/g, " ").replace(/\b\w/g, m => m.toUpperCase());
}

type IconType = React.ComponentType<any>;

// Export fallback icon and class for safety
export const FALLBACK_ICON = AlertCircle;
export const FALLBACK_CLASS = "text-gray-700 bg-gray-50";

const ICONS: Record<string, { Icon: IconType; className: string }> = {
  long_covid: { Icon: Stethoscope, className: "text-emerald-700 bg-emerald-50" },
  fibromyalgia: { Icon: Activity, className: "text-violet-700 bg-violet-50" },
  hidradenitis_suppurativa: { Icon: Flame, className: "text-rose-700 bg-rose-50" },
  obesity: { Icon: Thermometer, className: "text-amber-700 bg-amber-50" },
  ulcerative_colitis: { Icon: Microscope, className: "text-teal-800 bg-teal-50" },
  alzheimers_disease: { Icon: Brain, className: "text-indigo-700 bg-indigo-50" },
  type_2_diabetes: { Icon: Syringe, className: "text-cyan-700 bg-cyan-50" },
  parkinsons_disease: { Icon: Brain, className: "text-slate-700 bg-slate-50" },
  atopic_dermatitis: { Icon: Sparkles, className: "text-pink-700 bg-pink-50" },
  copd: { Icon: Wind, className: "text-sky-700 bg-sky-50" }, // Changed from Lungs to Wind
  rheumatoid_arthritis: { Icon: HeartPulse, className: "text-red-700 bg-rose-50" },
};

export function getConditionIcon(slug?: string | null): { Icon: IconType; className: string } {
  const fallback = { Icon: FALLBACK_ICON, className: FALLBACK_CLASS };
  if (!slug) {
    return fallback;
  }
  
  return ICONS[slug] ?? fallback;
}

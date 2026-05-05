// /frontend/shared/colors.ts
// Standardized color palette for PatientMatch UI components

export const STATUS_COLORS = {
  // Trial matching status
  likely: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    button: 'bg-emerald-600 hover:bg-emerald-700',
    full: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  },
  possible: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    button: 'bg-amber-600 hover:bg-amber-700',
    full: 'bg-amber-100 text-amber-800 border-amber-200'
  },
  no: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    button: 'bg-red-600 hover:bg-red-700',
    full: 'bg-red-50 text-red-700 border-red-200'
  },
  // Trial criteria status
  matches: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    full: 'bg-emerald-100 text-emerald-700 border-emerald-200'
  },
  partial: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    full: 'bg-amber-100 text-amber-700 border-amber-200'
  },
  different: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    full: 'bg-red-100 text-red-700 border-red-200'
  }
} as const;

export const CONDITION_COLORS = {
  long_covid: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    full: 'bg-emerald-100 text-emerald-700 border-emerald-200'
  },
  fibromyalgia: {
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
    full: 'bg-violet-100 text-violet-700 border-violet-200'
  },
  hidradenitis_suppurativa: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    full: 'bg-rose-100 text-rose-700 border-rose-200'
  },
  obesity: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    full: 'bg-amber-100 text-amber-700 border-amber-200'
  },
  migraine: {
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
    full: 'bg-violet-100 text-violet-700 border-violet-200'
  },
  ulcerative_colitis: {
    bg: 'bg-teal-50',
    text: 'text-teal-800',
    border: 'border-teal-200',
    full: 'bg-teal-100 text-teal-800 border-teal-200'
  },
  alzheimers_disease: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    full: 'bg-indigo-100 text-indigo-700 border-indigo-200'
  },
  type_2_diabetes: {
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-200',
    full: 'bg-cyan-100 text-cyan-700 border-cyan-200'
  },
  parkinsons_disease: {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    full: 'bg-slate-100 text-slate-700 border-slate-200'
  },
  atopic_dermatitis: {
    bg: 'bg-pink-50',
    text: 'text-pink-700',
    border: 'border-pink-200',
    full: 'bg-pink-100 text-pink-700 border-pink-200'
  },
  copd: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    full: 'bg-sky-100 text-sky-700 border-sky-200'
  },
  rheumatoid_arthritis: {
    bg: 'bg-rose-50',
    text: 'text-red-700',
    border: 'border-rose-200',
    full: 'bg-rose-100 text-red-700 border-rose-200'
  },
  osteoarthritis: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    full: 'bg-amber-100 text-amber-700 border-amber-200'
  },
  insomnia: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    full: 'bg-indigo-100 text-indigo-700 border-indigo-200'
  },
  anxiety: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    full: 'bg-sky-100 text-sky-700 border-sky-200'
  }
} as const;

// Helper functions
export function getStatusColors(status: keyof typeof STATUS_COLORS) {
  return STATUS_COLORS[status];
}

export function getConditionColors(conditionSlug: string) {
  return CONDITION_COLORS[conditionSlug as keyof typeof CONDITION_COLORS] || CONDITION_COLORS.long_covid;
}

export function getChipClasses(type: 'status' | 'condition', variant: string, size: 'sm' | 'md' = 'md') {
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-1' : 'text-xs px-3 py-1.5';
  
  if (type === 'status') {
    const colors = getStatusColors(variant as keyof typeof STATUS_COLORS);
    return `${sizeClasses} ${colors.full} rounded-xl font-medium`;
  } else {
    const colors = getConditionColors(variant);
    return `${sizeClasses} ${colors.full} rounded-xl font-medium`;
  }
}

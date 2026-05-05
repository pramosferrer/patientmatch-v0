// /frontend/shared/guessCondition.ts
const KEYWORDS: Record<string, string[]> = {
  long_covid: ["long covid", "pasc", "post-acute sequelae", "post covid", "long haul"],
  fibromyalgia: ["fibromyalgia", "fibro"],
  hidradenitis_suppurativa: ["hidradenitis", "hs", "acne inversa"],
  obesity: ["obesity", "overweight", "bmi", "weight loss", "body mass"],
  ulcerative_colitis: ["ulcerative colitis", "uc", "inflammatory bowel", "ibd"],
  alzheimers_disease: ["alzheimer", "alzheimers", "dementia", "cognitive decline"],
  type_2_diabetes: ["type 2 diabetes", "t2d", "type ii diabetes", "diabetes mellitus", "insulin resistance"],
  parkinsons_disease: ["parkinson", "parkinsons", "pd", "movement disorder"],
  atopic_dermatitis: ["atopic dermatitis", "eczema", "atopic eczema", "skin condition"],
  copd: ["copd", "chronic obstructive pulmonary", "emphysema", "chronic bronchitis"],
  rheumatoid_arthritis: ["rheumatoid arthritis", "ra", "inflammatory arthritis", "joint inflammation"],
};

export function guessConditionSlug(
  title: string,
  originals?: string[] | null
): string | null {
  const hay = (
    (originals ?? []).join(" ") + " " + (title || "")
  ).toLowerCase();

  if (!title && (!originals || originals.length === 0)) {
    return null;
  }

  for (const [slug, words] of Object.entries(KEYWORDS)) {
    if (words.some(w => hay.includes(w))) {
      return slug;
    }
  }
  
  return null;
}

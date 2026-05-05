import { ProfileCookie } from "@/shared/profileCookie";
import { parseAgeToYears } from "@/lib/trials/age";

export type ConfidenceBreakdown = {
  condition: boolean;
  zip: boolean;
  ageSex: boolean;
  screener: boolean;
};

export type MatchConfidenceResult = {
  score: number;
  label: string;
  message: string;
  breakdown: ConfidenceBreakdown;
};

export function calculateMatchConfidence(
  profile: ProfileCookie | null,
  trial?: any,
  isScreenerComplete: boolean = false
): MatchConfidenceResult {
  let score = 0;
  const p = profile || {};

  const hasCondition = Array.isArray(p.conditions) && p.conditions.length > 0;
  const hasZip = !!p.zip;
  const hasAgeSex = !!(p.age !== undefined && p.sex);

  // Weights
  if (hasCondition) score += 40;
  if (hasZip) score += 20;
  if (hasAgeSex) score += 30;
  
  // Trial-specific eligibility boost (if profile data exists)
  let isDemographicallyEligible = false;
  if (trial && hasAgeSex) {
    const age = p.age!;
    const sex = p.sex!;
    
    const minAge =
      typeof trial?.min_age_years === "number"
        ? trial.min_age_years
        : parseAgeToYears(trial?.minimum_age);
    const maxAge =
      typeof trial?.max_age_years === "number"
        ? trial.max_age_years
        : parseAgeToYears(trial?.maximum_age);
    const gender = trial.gender?.toLowerCase();

    const ageOk = (minAge === null || age >= minAge) && (maxAge === null || age <= maxAge);
    const sexOk = !gender || gender === "all" || gender === "both" || sex.toLowerCase() === gender;
    
    if (ageOk && sexOk) {
      isDemographicallyEligible = true;
      // We don't necessarily add to the score if it's already 90, 
      // but we could cap it or use this for the label.
    }
  }

  if (isScreenerComplete) score += 10;

  const breakdown: ConfidenceBreakdown = {
    condition: hasCondition,
    zip: hasZip,
    ageSex: hasAgeSex,
    screener: isScreenerComplete,
  };

  let label = getMatchLabel(score, breakdown);
  if (isDemographicallyEligible && score >= 90) {
    label = "Qualified Match";
  } else if (isDemographicallyEligible) {
    label = "Eligible Candidate";
  }

  const message = getMatchMessage(breakdown, score, isDemographicallyEligible);

  return {
    score,
    label,
    message,
    breakdown,
  };
}

function getMatchLabel(score: number, breakdown?: ConfidenceBreakdown): string {
  if (score >= 90) return "Global Match";
  if (score >= 60) return "Strong Candidate";
  if (score >= 40) return "Potential Match";
  
  // Specific low-score labels
  if (breakdown) {
    if (breakdown.condition && !breakdown.zip) return "Condition Match";
    if (breakdown.zip && !breakdown.condition) return "Location Match";
  }
  
  if (score > 0) return "Potential Match";
  return "Unmatched";
}

function getMatchMessage(
  breakdown: ConfidenceBreakdown, 
  score: number, 
  isDemographicallyEligible?: boolean
): string {
  if (score >= 100) return "Fully matched. Ready for enrollment.";
  if (isDemographicallyEligible && score >= 90) return "You meet eligibility requirements. Start screening.";
  if (score >= 90) return "Matches all global criteria. Complete screening to finalize.";
  
  if (!breakdown.condition) return "Select a condition to see relevant trials.";
  if (!breakdown.zip) return "Add ZIP code to check local availability.";
  if (!breakdown.ageSex) return "Add age and sex to verify basic eligibility.";
  
  return "Complete profile for higher confidence.";
}

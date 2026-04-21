"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Screener from "@/components/Screener";
import ScreenResult from "@/components/ScreenResult";
import { type EvaluationResult } from "@/lib/matching/evaluator";
import { Button } from "@/components/ui/button";
import { compactScreenerUI } from "@/config/uiFlags";
import type { ProfileCookie } from "@/shared/profileCookie";
import type { CriteriaJson, UiQuestion } from "@/lib/screener/types";
import { pmqToUiQuestions, type UserProfile } from "@/lib/pmqAdapter";
import { cn } from "@/lib/utils";

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function coerceBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["yes", "true", "y", "1"].includes(normalized)) return true;
    if (["no", "false", "n", "0"].includes(normalized)) return false;
  }
  return null;
}

function normalizeGender(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["male", "m", "man", "men"].includes(normalized)) return "male";
  if (["female", "f", "woman", "women"].includes(normalized)) return "female";
  if (["nonbinary", "non-binary", "nb"].includes(normalized)) return "nonbinary";
  if (["all", "any"].includes(normalized)) return "any";
  return normalized;
}

type Trial = {
  nct_id: string;
  title: string;
  sponsor?: string;
  condition?: string;
  conditionSlug?: string | null;
  min_age_years?: number | null;
  max_age_years?: number | null;
  gender?: string | null;
  questionnaire_json?: any | null;
};

type GateProfile = {
  age?: number;
  sex?: string | null;
  pregnancy?: boolean | null;
};

function deriveProfileFromAnswers(answers: Record<string, unknown>): GateProfile {
  const age =
    toFiniteNumber(answers.age) ??
    toFiniteNumber(answers.age_years) ??
    toFiniteNumber(answers["patient_age"]);

  const sexValue =
    typeof answers.sex === "string"
      ? answers.sex
      : typeof answers.gender === "string"
        ? answers.gender
        : undefined;

  const pregnancyRaw =
    answers.pregnancy ??
    answers.pregnant ??
    answers["is_pregnant"] ??
    answers["currently_pregnant"];

  return {
    age: age ?? undefined,
    sex: sexValue ?? null,
    pregnancy: coerceBoolean(pregnancyRaw),
  };
}

function formatAudience(trial: Trial): string {
  const segments: string[] = [];
  const gender = normalizeGender(trial.gender);
  if (gender === "female") {
    segments.push("women");
  } else if (gender === "male") {
    segments.push("men");
  } else {
    segments.push("people");
  }

  if (typeof trial.min_age_years === "number" && typeof trial.max_age_years === "number") {
    segments.push(`aged ${trial.min_age_years}–${trial.max_age_years}`);
  } else if (typeof trial.min_age_years === "number") {
    segments.push(`ages ${trial.min_age_years}+`);
  } else if (typeof trial.max_age_years === "number") {
    segments.push(`ages up to ${trial.max_age_years}`);
  }

  return segments.join(" ").trim() || "people";
}



type GateAssessment = {
  shouldGate: boolean;
  reasons: Array<"age-min" | "age-max" | "gender" | "pregnancy">;
  audience: string;
};

function assessGate(trial: Trial, profile: GateProfile): GateAssessment {
  const reasons: Array<"age-min" | "age-max" | "gender" | "pregnancy"> = [];
  const minAge = typeof trial.min_age_years === "number" ? trial.min_age_years : undefined;
  const maxAge = typeof trial.max_age_years === "number" ? trial.max_age_years : undefined;

  if (profile.age !== undefined) {
    if (typeof minAge === "number" && profile.age < minAge) {
      reasons.push("age-min");
    }
    if (typeof maxAge === "number" && profile.age > maxAge) {
      reasons.push("age-max");
    }
  }

  const genderRequirement = normalizeGender(trial.gender);
  const profileGender = normalizeGender(profile.sex ?? undefined);
  if (
    genderRequirement &&
    genderRequirement !== "any" &&
    profileGender &&
    genderRequirement !== profileGender
  ) {
    reasons.push("gender");
  }



  return {
    shouldGate: reasons.length > 0,
    reasons,
    audience: formatAudience(trial),
  };
}

const GATE_REASON_COPY: Record<"age-min" | "age-max" | "gender" | "pregnancy", string> = {
  "age-min": "The minimum age for this study is higher than what you shared.",
  "age-max": "This study has an upper age limit that you appear to exceed.",
  gender: "The study focuses on a specific gender identity.",
  pregnancy: "This study currently excludes people who are pregnant.",
};

function DemographicGate(props: {
  audience: string;
  reasons: Array<"age-min" | "age-max" | "gender" | "pregnancy">;
  onContinue: () => void;
}) {
  const { audience, reasons, onContinue } = props;
  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-3xl rounded-2xl border border-border/60 bg-white/90 p-8 shadow-[0_24px_48px_rgba(15,23,42,0.12)]">
        <h2 className="text-2xl font-semibold text-foreground">
          This study is designed for {audience}.
        </h2>
        <p className="mt-4 text-base text-muted-foreground">
          Based on what you shared, this particular trial may not be the best fit. You can still explore other studies that might match your situation more closely.
        </p>
        {reasons.length > 0 && (
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span>{GATE_REASON_COPY[reason]}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link href="/trials">See other studies</Link>
          </Button>
          <Button onClick={onContinue}>Continue anyway</Button>
        </div>
      </div>
    </div>
  );
}

type TrialScreenClientProps = {
  trial: Trial;
  initialAnswers?: Record<string, unknown>;
  precalculatedQuestions?: UiQuestion[];
  optionalQuestions?: UiQuestion[];
  initialProfile?: ProfileCookie | null;
  profileForPmq?: UserProfile;
  showDebug?: boolean;
  clinicPreview?: boolean;
};

function mergeProfiles(primary: ProfileCookie | null, secondary: ProfileCookie | null): ProfileCookie | null {
  const merged: ProfileCookie = {};
  const age = primary?.age ?? secondary?.age;
  if (typeof age === "number") {
    merged.age = age;
  }

  const sex = primary?.sex ?? secondary?.sex;
  if (sex) {
    merged.sex = sex;
  }

  const zip = primary?.zip ?? secondary?.zip;
  if (zip) {
    merged.zip = zip;
  }

  const pregnancy = primary?.pregnancy ?? secondary?.pregnancy;
  if (pregnancy === true || pregnancy === false) {
    merged.pregnancy = pregnancy;
  } else if (pregnancy === null) {
    merged.pregnancy = null;
  }

  const conditions = primary?.conditions ?? secondary?.conditions;
  if (Array.isArray(conditions) && conditions.length > 0) {
    merged.conditions = Array.from(new Set(conditions)).slice(0, 12);
  }

  return Object.keys(merged).length > 0 ? merged : null;
}

export default function TrialScreenClient({
  trial,
  initialAnswers = {},
  precalculatedQuestions,
  optionalQuestions = [],
  initialProfile = null,
  profileForPmq,
  showDebug = false,
  clinicPreview = false,
}: TrialScreenClientProps) {
  const searchParams = useSearchParams();
  const compactParam = searchParams.get("compact");
  const compact = useMemo(() => {
    if (!compactParam) {
      return compactScreenerUI;
    }
    return compactParam === "1";
  }, [compactParam]);
  const [answers, setAnswers] = useState<Record<string, unknown> | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [gateBypassed, setGateBypassed] = useState(false);
  const [profilePrefill, setProfilePrefill] = useState<ProfileCookie | null>(initialProfile ?? null);
  const [forSelf, setForSelf] = useState<boolean>(
    initialProfile?.for_self !== false, // default true unless explicitly false
  );
  const handleProfileCleared = useCallback(() => {
    setProfilePrefill(null);
  }, []);

  const handlePerspectiveToggle = () => {
    setForSelf((prev) => !prev);
    // Note: the profile save API doesn't accept for_self, so we keep this local only
  };

  const perspective = forSelf ? "self" : "other";

  // Re-compute questions client-side so the perspective toggle takes effect instantly
  const { mainQuestions: computedMain, optionalQuestions: computedOptional } = useMemo(() => {
    const qJson = trial.questionnaire_json;
    if (!qJson) {
      return {
        mainQuestions: precalculatedQuestions ?? [],
        optionalQuestions: optionalQuestions,
      };
    }
    return pmqToUiQuestions(qJson, profileForPmq, perspective);
  }, [trial.questionnaire_json, profileForPmq, perspective, precalculatedQuestions, optionalQuestions]);

  useEffect(() => {
    setProfilePrefill((prev) => mergeProfiles(initialProfile ?? null, prev));
  }, [initialProfile]);

  const gateProfile = useMemo(() => {
    const base = deriveProfileFromAnswers(initialAnswers);
    return {
      age: base.age ?? profilePrefill?.age ?? undefined,
      sex: base.sex ?? profilePrefill?.sex ?? null,
      pregnancy:
        base.pregnancy !== undefined && base.pregnancy !== null
          ? base.pregnancy
          : profilePrefill?.pregnancy ?? null,
    };
  }, [initialAnswers, profilePrefill]);
  const gateAssessment = useMemo(() => assessGate(trial, gateProfile), [trial, gateProfile]);

  const shouldShowGate =
    clinicPreview &&
    gateAssessment.shouldGate &&
    !gateBypassed &&
    answers === null &&
    evaluation === null;

  const handleCompleted = (payload: {
    answers: Record<string, unknown>;
    evaluation: EvaluationResult;
  }) => {
    setAnswers(payload.answers);
    setEvaluation(payload.evaluation);
  };

  // Show results if we have both answers and evaluation
  if (answers && evaluation) {
    return (
      <ScreenResult
        trial={{
          nct_id: trial.nct_id,
          title: trial.title,
          condition: trial.condition
        }}
        answers={answers}
        evaluation={evaluation}
        optionalQuestions={computedOptional}
        uiVariant={compact ? "compact" : "default"}
      />
    );
  }

  if (shouldShowGate) {
    return (
      <DemographicGate
        audience={gateAssessment.audience}
        reasons={gateAssessment.reasons}
        onContinue={() => setGateBypassed(true)}
      />
    );
  }

  // Show screener
  return (
    <div>
      <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground mb-3">
        <span>Searching for someone else?</span>
        <button
          type="button"
          role="switch"
          aria-checked={!forSelf}
          onClick={handlePerspectiveToggle}
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
            !forSelf ? "bg-blue-500" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
              !forSelf ? "translate-x-4" : "translate-x-1",
            )}
          />
        </button>
      </div>
      <Screener
        trial={trial}
        initialAnswers={initialAnswers}
        precalculatedQuestions={computedMain}
        optionalQuestions={computedOptional}
        initialProfile={profilePrefill ?? null}
        onProfileCleared={handleProfileCleared}
        onCompleted={handleCompleted}
        showDebug={showDebug}
        compact={compact}
        clinicPreview={clinicPreview}
      />
    </div>
  );
}

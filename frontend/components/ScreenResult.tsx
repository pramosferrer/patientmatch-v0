"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Download, ExternalLink, Info, Mail, Users, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { logEvent } from "@/lib/analytics";
import { SourceTag, type UiQuestion } from "@/lib/screener/types";
import { type EvaluationDetail, type EvaluationResult } from "@/lib/matching/evaluator";
import { toConditionSlug } from "@/shared/conditions-normalize";
import { useToast } from "@/hooks/useToast";
import Toast from "@/components/Toast";

type Trial = {
  nct_id: string;
  title: string;
  condition?: string;
  min_age_years?: number | null;
  max_age_years?: number | null;
  gender?: string | null;
};

type ScreenResultProps = {
  trial: Trial;
  answers: Record<string, unknown>;
  evaluation: EvaluationResult | null;
  optionalQuestions?: UiQuestion[];
  uiVariant?: "compact" | "default";
  screenerConfidence?: "strong" | "site_confirmed" | "basic" | "low" | string | null;
};

type ResultKey = EvaluationResult["result"];

const FEEDBACK_REASONS = [
  { value: "result_unclear", label: "Result was not clear" },
  { value: "missing_context", label: "Missing important context" },
  { value: "wrong_match", label: "Match result seems wrong" },
  { value: "too_technical", label: "Language felt too technical" },
  { value: "other", label: "Other" },
] as const;

const RESULT_COPY: Record<
  ResultKey,
  {
    label: string;
    summary: string;
    toneClass: string;
    borderClass: string;
    icon: typeof CheckCircle;
  }
> = {
  likely: {
    label: "You look like a strong fit",
    summary: "Based on your answers, you appear to meet the main eligibility criteria for this study.",
    toneClass: "text-emerald-700",
    borderClass: "border-l-emerald-500",
    icon: CheckCircle,
  },
  possible: {
    label: "You may qualify for this study",
    summary: "A few things still need to be confirmed, but you haven't been ruled out.",
    toneClass: "text-amber-700",
    borderClass: "border-l-amber-500",
    icon: AlertTriangle,
  },
  no: {
    label: "This study may not be the right fit",
    summary: "Based on your answers, this trial may not match your current situation — but other studies might.",
    toneClass: "text-slate-700",
    borderClass: "border-l-slate-400",
    icon: XCircle,
  },
};

function getConfidenceCopy(
  confidence: ScreenResultProps["screenerConfidence"],
  result: ResultKey,
): { label: string; summary: string } | null {
  if (result === "no") return null;
  switch (confidence) {
    case "strong":
      return {
        label: "Strong pre-screen",
        summary: "Your answers match the main patient-answerable checks we could screen here.",
      };
    case "site_confirmed":
      return {
        label: "Site-confirmed pre-screen",
        summary: "You may qualify, but the study team still needs to confirm labs, imaging, records, or other clinical details.",
      };
    case "basic":
      return {
        label: "Basic pre-screen",
        summary: "This study has only a short set of patient-answerable questions, so the site should confirm the rest.",
      };
    case "low":
      return {
        label: "Limited pre-screen",
        summary: "This trial's eligibility could not be screened confidently from the available questions.",
      };
    default:
      return null;
  }
}

const REPRODUCTIVE_CATEGORIES = new Set([
  "pregnancy",
  "breastfeeding",
  "lactation",
  "reproductive_health",
]);

function normalizeSex(value: unknown): "male" | "female" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "male" || normalized === "m") return "male";
  if (normalized === "female" || normalized === "f") return "female";
  return null;
}

function isReproductiveCriterion(detail: EvaluationDetail): boolean {
  if (!detail.category) return false;
  const normalized = detail.category.trim().toLowerCase().replace(/\s+/g, "_");
  return REPRODUCTIVE_CATEGORIES.has(normalized);
}

function SectionList(props: {
  title: string;
  count: number;
  icon: typeof CheckCircle;
  toneClass: string;
  items: EvaluationDetail[];
  emptyLabel: string;
  note?: string;
  renderItem: (detail: EvaluationDetail) => ReactNode;
}) {
  const { title, count, icon: Icon, toneClass, items, emptyLabel, note, renderItem } = props;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <h4 className={cn("text-sm font-semibold flex items-center gap-2", toneClass)}>
          <Icon className="h-4 w-4" />
          {title}
        </h4>
        <span className="text-xs font-medium text-muted-foreground">{count}</span>
      </div>
      {note && <p className="text-xs text-muted-foreground/80 -mt-1">{note}</p>}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-0 text-sm text-foreground/90 divide-y divide-border/30">
          {items.map((detail) => (
            <li key={detail.id} className="flex items-start gap-2.5 py-2.5">
              <span className="mt-[5px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted-foreground/40" aria-hidden="true" />
              <span className="min-w-0">{renderItem(detail)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Convert a question-form label to a concise negative statement for "No" answers. */
function negateLabel(label: string): string {
  const raw = label.replace(/\?$/, "").trim();
  if (/^are you currently\s+/i.test(raw)) return raw.replace(/^are you currently\s+/i, "Not currently ");
  if (/^are you\s+/i.test(raw)) return raw.replace(/^are you\s+/i, "Not ");
  if (/^have you ever\s+/i.test(raw)) return raw.replace(/^have you ever\s+/i, "No history of ");
  if (/^have you\s+/i.test(raw)) return raw.replace(/^have you\s+/i, "No ");
  if (/^do you currently\s+/i.test(raw)) return raw.replace(/^do you currently\s+/i, "Not currently ");
  if (/^do you\s+/i.test(raw)) return raw.replace(/^do you\s+/i, "Does not ");
  if (/^were you\s+/i.test(raw)) return raw.replace(/^were you\s+/i, "Not ");
  if (/^is your\s+/i.test(raw)) return raw.replace(/^is your\s+/i, "No ");
  return raw; // fallback: use statement as-is
}

function formatMetDetail(
  detail: EvaluationDetail,
  answers: Record<string, unknown>,
  trial?: { min_age_years?: number | null; max_age_years?: number | null; gender?: string | null },
): ReactNode {
  const id = detail.id.toLowerCase();
  const label = detail.label.toLowerCase();

  if (id.includes("age") || label.includes("how old") || label.includes("your age")) {
    const age = answers.age_years ?? answers.age ?? answers.dem_age ?? answers[detail.id];
    if (typeof age === "number") {
      const min = trial?.min_age_years;
      const max = trial?.max_age_years;
      if (min != null && max != null) return `Age ${age} — within this study's ${min}–${max} year range`;
      if (min != null) return `Age ${age} — meets the minimum age of ${min}`;
      if (max != null) return `Age ${age} — within the study's age limit of ${max}`;
      return `Age ${age} — meets the study's age requirement`;
    }
  }

  if (id.includes("sex") || id.includes("gender") || label.includes("assigned at birth") || label.includes("sex were you")) {
    const raw = answers.sex_at_birth ?? answers.sex ?? answers.dem_sex ?? answers[detail.id];
    if (typeof raw === "string" && raw.trim()) {
      const fmt = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
      return `${fmt} — matches the study's focus`;
    }
  }

  if (id.includes("diagnos") || label.includes("diagnosed with") || label.includes("do you have")) {
    const val = answers[detail.id] ?? answers.diagnosis_confirmed;
    if (val === true) return "Diagnosis confirmed — matches this study's focus";
    if (Array.isArray(val) && val.length > 0) {
      const filtered = val.filter((v) => typeof v === "string" && !["none of the above", "not sure"].includes(v.toLowerCase()));
      if (filtered.length > 0) return `${filtered.slice(0, 2).join(", ")} — matches this study's focus`;
    }
    if (typeof val === "string" && val.trim() && val !== "true") return `${val} — matches this study's focus`;
  }

  if (id.includes("ecog") || id.includes("activity") || label.includes("activity") || label.includes("daily")) {
    const val = answers[detail.id];
    if (typeof val === "string" && val.trim()) {
      const short = val.length > 45 ? val.slice(0, 45) + "…" : val;
      return `Activity level (${short}) — meets the study's requirements`;
    }
    return "Activity level — meets the study's requirements";
  }

  const val = answers[detail.id];

  // "No" answer (exclusion criterion correctly cleared)
  const isNo = val === false || (typeof val === "string" && val.toLowerCase() === "no");
  if (isNo) {
    return `${negateLabel(detail.label)} — meets the study's criteria`;
  }

  // "Yes" or true answer
  const isYes = val === true || (typeof val === "string" && val.toLowerCase() === "yes");
  if (isYes) {
    return `${detail.label.replace(/\?$/, "").trim()} — confirmed`;
  }

  // Multi-select array
  if (Array.isArray(val) && val.length > 0) {
    const readable = val.filter((v) => typeof v === "string" && !["none of the above", "not sure"].includes(v.toLowerCase()));
    if (readable.length > 0) return `${readable.slice(0, 2).join(", ")} — meets the study's criteria`;
  }

  // Freetext string answer
  if (typeof val === "string" && val.trim() && !["true", "false"].includes(val)) {
    return `${val} — meets the study's criteria`;
  }

  // Fallback: show criterion as a confirmed statement
  return `${detail.label.replace(/\?$/, "").trim()} — confirmed`;
}

function criterionStatement(label: string): string {
  // Strip trailing "?" so it reads as a criterion, not a re-interrogation
  return label.replace(/\?$/, '').trim();
}

function formatUnmetDetail(detail: EvaluationDetail, answers: Record<string, unknown>): ReactNode {
  const note = getDiscussionNote(detail);
  const statement = criterionStatement(detail.label);

  const raw = answers[detail.id];
  let answerLabel: string | null = null;
  if (raw === true) answerLabel = 'Yes';
  else if (raw === false) answerLabel = 'No';
  else if (typeof raw === 'string' && raw.trim() && !['true', 'false'].includes(raw)) {
    answerLabel = raw;
  }

  return (
    <span className="block space-y-1">
      <span className="block text-sm leading-snug text-foreground/90">{statement}</span>
      {answerLabel && (
        <span className="block text-[11.5px] text-muted-foreground">
          You answered: <span className="font-medium text-foreground/70">{answerLabel}</span>
        </span>
      )}
      {note && (
        <span className="block text-[11.5px] leading-snug text-muted-foreground/65">{note}</span>
      )}
    </span>
  );
}

function formatUnknownDetail(detail: EvaluationDetail): ReactNode {
  const note = getDiscussionNote(detail);
  const statement = criterionStatement(detail.label);

  return (
    <span className="block space-y-1">
      <span className="block text-sm leading-snug text-foreground/90">{statement}</span>
      {note && (
        <span className="block text-[11.5px] leading-snug text-muted-foreground/65">{note}</span>
      )}
    </span>
  );
}

function getDiscussionNote(detail: EvaluationDetail): string | null {
  const text = `${detail.label} ${detail.category ?? ""}`.toLowerCase();
  if ((text.includes("another cancer") || text.includes("5 years") || text.includes("prior_malign"))) {
    return "This study focuses on a single active cancer — your oncologist can check your records.";
  }
  if (text.includes("brain") && (text.includes("cancer") || text.includes("spread") || text.includes("metastas"))) {
    return "Brain involvement can be confirmed with imaging results your doctor already has.";
  }
  if (text.includes("another clinical trial") || text.includes("other_trial") || text.includes("tests a treatment")) {
    return "Being in another study may conflict — your care team can advise.";
  }
  if (text.includes("experimental") || text.includes("investigational") || text.includes("4 weeks")) {
    return "Recent experimental treatments may need a washout period before joining a new study.";
  }
  if (text.includes("allerg")) {
    return "Allergies to study medications are a safety check your doctor can confirm.";
  }
  if (text.includes("cancer treatment") || text.includes("14 days") || text.includes("recent_cancer")) {
    return "Recent treatments may need time to clear — your oncologist can advise.";
  }
  if (text.includes("hepatitis") || text.includes("hiv") || text.includes("infection")) {
    return "Some infections can affect how the study drug is processed by your body.";
  }
  if (text.includes("kidney") || text.includes("liver") || text.includes("organ function")) {
    return "Recent lab results from your doctor can confirm this.";
  }
  if (text.includes("hemoglobin") || text.includes("blood count") || text.includes("platelet")) {
    return "A recent blood test from your records can confirm this.";
  }
  return null;
}

export default function ScreenResult({
  trial,
  answers: initialAnswers,
  evaluation,
  optionalQuestions = [],
  uiVariant = "default",
  screenerConfidence = null,
}: ScreenResultProps) {
  const router = useRouter();
  const answers = initialAnswers;
  const hasLoggedUnknownEvent = useRef(false);
  const { toasts, addToast, removeToast } = useToast();
  const isCompactUI = uiVariant === "compact";
  const [feedbackChoice, setFeedbackChoice] = useState<boolean | null>(null);
  const [feedbackReason, setFeedbackReason] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const hasTrackedResultViewRef = useRef(false);

  useEffect(() => {
    const unknownDetails = evaluation?.unknown_details ?? [];
    const hasClinicUnknown = unknownDetails.some((detail) => detail.sourceTag === SourceTag.Clinic);
    if (hasClinicUnknown && !hasLoggedUnknownEvent.current) {
      logEvent("screener_unknowns_present", {
        nct_id: trial.nct_id,
        count: unknownDetails.length,
        ...(isCompactUI ? { ui: "compact" as const } : {}),
      });
      hasLoggedUnknownEvent.current = true;
    }
  }, [evaluation, isCompactUI, trial.nct_id]);

  useEffect(() => {
    if (!evaluation || hasTrackedResultViewRef.current) return;
    hasTrackedResultViewRef.current = true;
    logEvent("patient_result_viewed", {
      nct_id: trial.nct_id,
      result: evaluation.result,
      score: evaluation.score,
      met_count: evaluation.met_details?.length ?? 0,
      unmet_count: evaluation.unmet_details?.length ?? 0,
      unknown_count: evaluation.unknown_details?.length ?? 0,
      ...(isCompactUI ? { ui: "compact" as const } : {}),
    });
  }, [evaluation, isCompactUI, trial.nct_id]);

  if (!evaluation) {
    return (
      <div className="w-full space-y-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Loading evaluation results...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { result, score, met_details = [], unknown_details = [], unmet_details = [], reasons = [] } = evaluation;
  const resultCopy = RESULT_COPY[result];
  const ResultIcon = resultCopy.icon;
  const confidenceCopy = getConfidenceCopy(screenerConfidence, result);

  const sexAnswer = answers.sex ?? answers.gender ?? answers.dem_sex ?? answers.sex_at_birth;
  const isMale = normalizeSex(sexAnswer) === "male";
  const filteredUnknownDetails = isMale
    ? unknown_details.filter((detail) => !isReproductiveCriterion(detail))
    : unknown_details;

  // Synthesize profile-based demographic matches that the evaluator never sees
  // (the adapter removes pre-filled questions from the question list before evaluation)
  const profileSynthesized: EvaluationDetail[] = [];
  const ageVal = answers.age_years ?? answers.age;
  if (typeof ageVal === "number" && !met_details.some((d) => d.id.toLowerCase().includes("age"))) {
    profileSynthesized.push({ id: "age_years", label: "Your age", clauseType: "inclusion", status: "met" });
  }
  const sexVal = answers.sex_at_birth ?? answers.sex;
  if (typeof sexVal === "string" && sexVal.trim() && !met_details.some((d) => d.id.toLowerCase().includes("sex") || d.id.toLowerCase().includes("gender"))) {
    const trialGender = trial.gender?.toLowerCase() ?? "";
    const sexNorm = sexVal.toLowerCase();
    if (!trialGender || trialGender === "all" || trialGender === "any" || trialGender.includes(sexNorm) || trialGender === "unknown") {
      profileSynthesized.push({ id: "sex_at_birth", label: "Your sex", clauseType: "inclusion", status: "met" });
    }
  }
  const diagVal = answers.diagnosis_confirmed;
  if (diagVal === true && !met_details.some((d) => d.id.toLowerCase().includes("diagnos"))) {
    profileSynthesized.push({ id: "diagnosis_confirmed", label: "Have you been diagnosed with the condition this study targets?", clauseType: "inclusion", status: "met" });
  }

  const highlightedMet = [...profileSynthesized, ...met_details]; // show all — patients deserve to see everything they passed
  const highlightedUnknown = filteredUnknownDetails.slice(0, 6);
  const highlightedUnmet = unmet_details.slice(0, 6);


  const handleExportPDF = () => {
    window.print();
  };

  const handleEmailDoctor = () => {
    const subject = encodeURIComponent(`Clinical Trial Eligibility Summary — ${trial.title}`);
    const metLines = met_details.length > 0
      ? `Criteria I meet:\n${met_details.slice(0, 6).map((d) => `  • ${d.label}`).join("\n")}\n\n`
      : "";
    const unknownLines = filteredUnknownDetails.length > 0
      ? `Things that need confirmation:\n${filteredUnknownDetails.slice(0, 6).map((d) => `  • ${d.label}`).join("\n")}\n\n`
      : "";
    const unmetLines = unmet_details.length > 0
      ? `Possible concerns:\n${unmet_details.slice(0, 6).map((d) => `  • ${d.label}`).join("\n")}\n\n`
      : "";
    const body = encodeURIComponent(
      `Hi,\n\nI completed an eligibility screening for a clinical trial and wanted to share the results with you.\n\n` +
      `Trial: ${trial.title}\n` +
      `Study ID: ${trial.nct_id}\n` +
      `Result: ${resultCopy.label}\n\n` +
      metLines + unknownLines + unmetLines +
      `Full study details: https://clinicaltrials.gov/study/${trial.nct_id}\n\nThank you`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleFeedbackSubmit = async () => {
    if (feedbackChoice === null) {
      setFeedbackError("Choose whether this result was helpful.");
      return;
    }

    if (!feedbackChoice && !feedbackReason) {
      setFeedbackError("Choose what felt off so we can improve this result.");
      return;
    }

    setFeedbackSubmitting(true);
    setFeedbackError(null);
    try {
      const response = await fetch("/api/feedback/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nct_id: trial.nct_id,
          result_label: result,
          helpful: feedbackChoice,
          reason_code: feedbackReason || null,
          context: {
            met_count: met_details.length,
            unknown_count: filteredUnknownDetails.length,
            unmet_count: unmet_details.length,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("feedback request failed");
      }

      setFeedbackSubmitted(true);
      logEvent("result_feedback_submitted", {
        nct_id: trial.nct_id,
        result,
        helpful: feedbackChoice,
        reason_code: feedbackReason || undefined,
      });
      addToast("Thanks for your feedback", "success");
    } catch {
      setFeedbackError("Could not submit feedback right now. Please try again.");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const conditionSlug = trial.condition ? toConditionSlug(trial.condition) : "";
  const similarTrialsHref = conditionSlug ? `/trials?condition=${encodeURIComponent(conditionSlug)}` : "/trials";

  return (
    <>
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>

      <div className="w-full space-y-4">
        <Card className={cn("bg-white overflow-hidden rounded-lg border-l-4", resultCopy.borderClass)}>
          <CardContent className="space-y-5 p-6">
            <header className="space-y-2">
              <div className="flex items-center gap-2">
                <ResultIcon className={cn("h-5 w-5", resultCopy.toneClass)} />
                <h3 className={cn("text-lg font-semibold", resultCopy.toneClass)}>{resultCopy.label}</h3>
              </div>
              <p className="text-sm text-foreground/90">{resultCopy.summary}</p>
              {confidenceCopy && (
                <p className="flex items-start gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
                  <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-sky-700" aria-hidden="true" />
                  <span>
                    <span className="font-medium">{confidenceCopy.label}:</span> {confidenceCopy.summary}
                  </span>
                </p>
              )}
              {result !== "no" && (
                <p className="flex items-start gap-1.5 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary/70" aria-hidden="true" />
                  These results are suggestions based on public trial data and your answers. The study team makes the final eligibility decision.
                </p>
              )}
            </header>

            <div className="space-y-5 border-t border-border/50 pt-4">
              <SectionList
                title="Criteria you meet"
                count={highlightedMet.length}
                icon={CheckCircle}
                toneClass="text-emerald-700"
                items={highlightedMet}
                emptyLabel="No confirmed matches yet."
                renderItem={(detail) => formatMetDetail(detail, answers, trial)}
              />

              {filteredUnknownDetails.length > 0 && (
                <SectionList
                  title="Confirm with your doctor"
                  count={filteredUnknownDetails.length}
                  icon={Info}
                  toneClass="text-sky-700"
                  items={highlightedUnknown}
                  emptyLabel=""
                  note="Your doctor can look these up in your medical records — they're not automatic disqualifiers."
                  renderItem={(detail) => formatUnknownDetail(detail)}
                />
              )}

              {unmet_details.length > 0 && (
                <SectionList
                  title="Criteria you may not meet"
                  count={unmet_details.length}
                  icon={XCircle}
                  toneClass="text-slate-600"
                  items={highlightedUnmet}
                  emptyLabel=""
                  note="Based on your answers, these criteria weren't matched. Talk to the study team — some have exceptions, or another study may be a better fit."
                  renderItem={(detail) => formatUnmetDetail(detail, answers)}
                />
              )}

              <div className="pt-2 border-t border-border/40 space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What happens next</p>
                <ol className="space-y-3">
                  <li className="flex gap-3 text-sm">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">1</span>
                    <span>
                      <span className="font-medium text-foreground">Save or share this summary</span>
                      <span className="text-muted-foreground"> — email it to your doctor or download as PDF</span>
                      <div className="mt-2 flex flex-wrap gap-2 pm-print-hide">
                        <Button variant="outline" size="sm" onClick={handleEmailDoctor} className="gap-2">
                          <Mail className="h-4 w-4" />
                          Email to my doctor
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2">
                          <Download className="h-4 w-4" />
                          Save as PDF
                        </Button>
                      </div>
                    </span>
                  </li>
                  <li className="flex gap-3 text-sm">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">2</span>
                    <span>
                      <span className="font-medium text-foreground">Talk to your doctor</span>
                      <span className="text-muted-foreground"> — bring the flagged items above to your next appointment for confirmation</span>
                    </span>
                  </li>
                  <li className="flex gap-3 text-sm">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">3</span>
                    <span>
                      <span className="font-medium text-foreground">Review the official listing</span>
                      <span className="text-muted-foreground"> — if you&apos;re ready to learn more, </span>
                      <a
                        href={`https://clinicaltrials.gov/study/${trial.nct_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        view the study on ClinicalTrials.gov
                      </a>
                    </span>
                  </li>
                </ol>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-background/60 p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">Was this result helpful?</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={feedbackChoice === true ? "default" : "outline"}
                  onClick={() => {
                    setFeedbackChoice(true);
                    setFeedbackReason("");
                    setFeedbackError(null);
                  }}
                  disabled={feedbackSubmitted}
                >
                  Yes
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={feedbackChoice === false ? "default" : "outline"}
                  onClick={() => {
                    setFeedbackChoice(false);
                    setFeedbackError(null);
                  }}
                  disabled={feedbackSubmitted}
                >
                  No
                </Button>
              </div>

              {feedbackChoice === false && (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground" htmlFor="result-feedback-reason">
                    What should we improve?
                  </label>
                  <select
                    id="result-feedback-reason"
                    value={feedbackReason}
                    onChange={(event) => setFeedbackReason(event.target.value)}
                    className="pm-native-select w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                    disabled={feedbackSubmitted}
                  >
                    <option value="">Select one</option>
                    {FEEDBACK_REASONS.map((reasonOption) => (
                      <option key={reasonOption.value} value={reasonOption.value}>
                        {reasonOption.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {feedbackError && <p className="text-xs text-red-600">{feedbackError}</p>}
              {feedbackSubmitted ? (
                <p className="text-xs text-emerald-700">Feedback saved. Thank you.</p>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleFeedbackSubmit}
                  disabled={feedbackChoice === null || feedbackSubmitting}
                >
                  {feedbackSubmitting ? "Sending..." : "Send feedback"}
                </Button>
              )}
            </div>

            {result === "no" && (
              <div className="space-y-3">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900 mb-1">Other studies may still fit</h4>
                  <p className="text-sm text-blue-700">
                    Eligibility varies by study. You may still be a match for a similar trial.
                  </p>
                </div>
                <Button variant="outline" onClick={() => router.push(similarTrialsHref)} className="w-full">
                  <Users className="mr-2 h-4 w-4" />
                  Browse similar trials
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <a
                href={`https://clinicaltrials.gov/study/${trial.nct_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View full study details
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

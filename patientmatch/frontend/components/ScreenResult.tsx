"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { AlertCircle, AlertTriangle, CheckCircle, ExternalLink, Info, Share2, Users, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { logEvent } from "@/lib/analytics";
import { SourceTag, type UiQuestion } from "@/lib/screener/types";
import { type EvaluationDetail, type EvaluationResult } from "@/lib/matching/evaluator";
import { toConditionSlug } from "@/shared/conditions-normalize";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useToast } from "@/hooks/useToast";
import Toast from "@/components/Toast";
import LeadForm from "./LeadForm";
import { MagicLinkDialog } from "@/components/auth/MagicLinkDialog";

type Trial = {
  nct_id: string;
  title: string;
  condition?: string;
};

type ScreenResultProps = {
  trial: Trial;
  answers: Record<string, unknown>;
  evaluation: EvaluationResult | null;
  optionalQuestions?: UiQuestion[];
  uiVariant?: "compact" | "default";
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
    label: "Likely match",
    summary: "You appear to meet the main study criteria based on your answers.",
    toneClass: "text-emerald-700",
    borderClass: "border-l-emerald-500",
    icon: CheckCircle,
  },
  possible: {
    label: "Possible match",
    summary: "You may qualify, but some criteria still need confirmation from the study team.",
    toneClass: "text-amber-700",
    borderClass: "border-l-amber-500",
    icon: AlertTriangle,
  },
  no: {
    label: "Not likely a match",
    summary: "Based on your answers, this study may not be the best fit right now.",
    toneClass: "text-slate-700",
    borderClass: "border-l-slate-400",
    icon: XCircle,
  },
};

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
  renderItem: (detail: EvaluationDetail) => string;
}) {
  const { title, count, icon: Icon, toneClass, items, emptyLabel, renderItem } = props;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <h4 className={cn("text-sm font-semibold flex items-center gap-2", toneClass)}>
          <Icon className="h-4 w-4" />
          {title}
        </h4>
        <span className="text-xs font-medium text-muted-foreground">{count}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2 text-sm text-foreground/90">
          {items.map((detail) => (
            <li key={detail.id} className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-muted-foreground/60" aria-hidden="true" />
              <span>{renderItem(detail)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ScreenResult({
  trial,
  answers: initialAnswers,
  evaluation,
  optionalQuestions = [],
  uiVariant = "default",
}: ScreenResultProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);
  const hasLoggedUnknownEvent = useRef(false);
  const { toasts, addToast, removeToast } = useToast();
  const isCompactUI = uiVariant === "compact";
  const { user } = useSupabaseAuth();
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [alertsBusy, setAlertsBusy] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [magicLinkOpen, setMagicLinkOpen] = useState(false);
  const [feedbackChoice, setFeedbackChoice] = useState<boolean | null>(null);
  const [feedbackReason, setFeedbackReason] = useState("");
  const [feedbackComment, setFeedbackComment] = useState("");
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

  const sexAnswer = answers.sex ?? answers.gender ?? answers.dem_sex ?? answers.sex_at_birth;
  const isMale = normalizeSex(sexAnswer) === "male";
  const filteredUnknownDetails = isMale
    ? unknown_details.filter((detail) => !isReproductiveCriterion(detail))
    : unknown_details;

  const highlightedMet = met_details.slice(0, 5);
  const highlightedUnknown = filteredUnknownDetails.slice(0, 6);
  const highlightedUnmet = unmet_details.slice(0, 6);
  const clinicCheckCount = filteredUnknownDetails.filter((detail) => detail.sourceTag === SourceTag.Clinic).length;

  const totalsSummary = `${met_details.length} matched • ${filteredUnknownDetails.length} questions for doctor • ${unmet_details.length} potential blockers`;

  const handleCopySummary = async () => {
    const lines: string[] = [
      `Trial: ${trial.nct_id}`,
      `Result: ${resultCopy.label}`,
      `Summary: ${resultCopy.summary}`,
      `Matched criteria: ${met_details.length}`,
      `Questions for doctor: ${filteredUnknownDetails.length}`,
      `Potential blockers: ${unmet_details.length}`,
      `Clinic checks needed: ${clinicCheckCount}`,
    ];
    if (reasons.length > 0) {
      lines.push("Notes:");
      reasons.slice(0, 3).forEach((reason) => lines.push(`- ${reason}`));
    }
    const summary = lines.join("\n");

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary);
      } else if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea");
        textarea.value = summary;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      } else {
        throw new Error("Clipboard API unavailable");
      }
      addToast("Summary copied", "success");
    } catch {
      addToast("Could not copy summary", "error");
    }
  };

  const handleAlertToggle = async () => {
    if (alertsBusy) return;
    if (!user) {
      setMagicLinkOpen(true);
      return;
    }

    const nextEnabled = !alertsEnabled;
    setAlertsBusy(true);
    setAlertsError(null);
    setAlertsEnabled(nextEnabled);

    try {
      const response = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert_opt_in: nextEnabled }),
      });
      if (!response.ok) {
        throw new Error(`Profile update failed with status ${response.status}`);
      }
    } catch {
      setAlertsEnabled(!nextEnabled);
      setAlertsError("We couldn't update your alert settings. Please try again.");
    } finally {
      setAlertsBusy(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (feedbackChoice === null) {
      setFeedbackError("Choose whether this result was helpful.");
      return;
    }

    const trimmedComment = feedbackComment.trim();
    if (!feedbackChoice && !feedbackReason && trimmedComment.length < 6) {
      setFeedbackError("Tell us what felt off so we can improve this result.");
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
          comment: trimmedComment || null,
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
        has_comment: trimmedComment.length > 0,
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

  const renderUnmetLabel = (detail: EvaluationDetail) =>
    detail.clauseType === "exclusion" ? `May exclude: ${detail.label}` : `Needs review: ${detail.label}`;

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
            <header className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ResultIcon className={cn("h-5 w-5", resultCopy.toneClass)} />
                  <h3 className={cn("text-lg font-semibold", resultCopy.toneClass)}>{resultCopy.label}</h3>
                </div>
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Save summary for your doctor
                </button>
              </div>
              <p className="text-sm text-foreground/90">{resultCopy.summary}</p>
              <p className="text-xs text-muted-foreground">
                {totalsSummary} • <span className="font-mono">{trial.nct_id}</span>
              </p>
            </header>

            <div className="space-y-5 border-t border-border/50 pt-4">
              <SectionList
                title="What matched"
                count={met_details.length}
                icon={CheckCircle}
                toneClass="text-emerald-700"
                items={highlightedMet}
                emptyLabel="No confirmed matched criteria yet."
                renderItem={(detail) => detail.label}
              />

              <SectionList
                title="Questions to ask your doctor"
                count={filteredUnknownDetails.length}
                icon={Info}
                toneClass="text-sky-700"
                items={highlightedUnknown}
                emptyLabel="No additional confirmation needed."
                renderItem={(detail) => detail.label}
              />

              <SectionList
                title="Potential blockers"
                count={unmet_details.length}
                icon={AlertCircle}
                toneClass="text-amber-700"
                items={highlightedUnmet}
                emptyLabel="No clear blockers based on current answers."
                renderItem={renderUnmetLabel}
              />

              {highlightedUnknown.length > 0 && (
                <div className="rounded-lg border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="inline-flex items-center gap-1 cursor-help">
                        <Info className="h-3.5 w-3.5" />
                        About these questions
                      </p>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p>Your doctor can confirm these based on your medical history. Bring this list to your next appointment.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}

              {reasons.length > 0 && (
                <div className="rounded-lg border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
                  {reasons.slice(0, 3).map((reason, index) => (
                    <div key={`${reason}-${index}`}>• {reason}</div>
                  ))}
                </div>
              )}

              {optionalQuestions.length > 0 && (
                <div className="pt-2">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="optional" className="border-none">
                      <AccordionTrigger className="text-sm font-semibold text-blue-800 hover:text-blue-900 hover:no-underline py-2 bg-blue-50/50 px-3 rounded-lg">
                        Share extra details with the research team ({optionalQuestions.length})
                      </AccordionTrigger>
                      <AccordionContent className="pt-4 px-1">
                        <p className="text-xs text-muted-foreground mb-4">
                          These answers are shared with the study team if you continue. They do not change your current
                          result on this page.
                        </p>
                        <div className="space-y-6">
                          {optionalQuestions.map((question) => (
                            <div key={question.id} className="space-y-2 pb-4 border-b border-border/40 last:border-0 last:pb-0">
                              <label className="text-sm font-medium text-foreground">{question.label}</label>
                              {question.kind === "choice" ? (
                                <div className="flex flex-wrap gap-2">
                                  {question.options?.map((option) => (
                                    <button
                                      key={option}
                                      type="button"
                                      onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option }))}
                                      className={cn(
                                        "px-3 py-2 text-sm rounded-lg border transition",
                                        answers[question.id] === option
                                          ? "border-blue-500 bg-blue-100 text-blue-800"
                                          : "border-border bg-white text-muted-foreground hover:bg-muted",
                                      )}
                                    >
                                      {option}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <Input
                                  type={question.kind === "number" ? "number" : "text"}
                                  value={String(answers[question.id] ?? "")}
                                  onChange={(event) => {
                                    const val = event.target.value;
                                    setAnswers((prev) => ({
                                      ...prev,
                                      [question.id]:
                                        question.kind === "number" ? (val === "" ? undefined : Number(val)) : val,
                                    }));
                                  }}
                                  className="max-w-xs"
                                  placeholder={question.kind === "number" ? "Enter value..." : "Type here..."}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border/60 bg-white/70 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Get alerts for similar studies</p>
                  <p className="text-xs text-muted-foreground">
                    We&apos;ll email at most once per week. You can stop anytime.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={alertsEnabled}
                  aria-label="Toggle alerts for similar trials"
                  onClick={handleAlertToggle}
                  disabled={alertsBusy}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-lg transition",
                    alertsEnabled ? "bg-emerald-500" : "bg-muted",
                    alertsBusy ? "cursor-wait opacity-60" : "cursor-pointer",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-5 w-5 transform rounded-lg bg-white shadow transition",
                      alertsEnabled ? "translate-x-5" : "translate-x-1",
                    )}
                  />
                </button>
              </div>
              {alertsError && <p className="mt-3 text-xs text-red-600">{alertsError}</p>}
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

              {feedbackChoice !== null && (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground" htmlFor="result-feedback-comment">
                    Optional note
                  </label>
                  <textarea
                    id="result-feedback-comment"
                    value={feedbackComment}
                    onChange={(event) => setFeedbackComment(event.target.value)}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                    placeholder="What felt confusing or missing?"
                    rows={3}
                    disabled={feedbackSubmitted}
                  />
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

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="contact" className="border rounded-xl px-4">
            <AccordionTrigger
              className="text-sm font-semibold hover:no-underline py-3"
              onClick={() => logEvent("patient_lead_form_opened", { nct_id: trial.nct_id, result })}
            >
              Contact the research team
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <LeadForm
                nct_id={trial.nct_id}
                trial_title={trial.title}
                condition={trial.condition}
                match_result={result === "likely" ? "qualifies" : result === "possible" ? "possible" : "not_qualified"}
                answers_json={{
                  answers,
                  evaluation: {
                    result,
                    score,
                    met: met_details,
                    unknown: unknown_details,
                    unmet: unmet_details,
                  },
                }}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <MagicLinkDialog open={magicLinkOpen} onOpenChange={setMagicLinkOpen} />
      </div>
    </>
  );
}

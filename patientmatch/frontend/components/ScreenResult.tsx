"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { CheckCircle, AlertTriangle, XCircle, ArrowRight, Users, Info, Share2, AlertCircle, Check, HelpCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { getStatusColors } from "@/shared/colors";
import { cn } from "@/lib/utils";
import { type EvaluationResult } from "@/lib/matching/evaluator";
import { SourceTag } from "@/lib/screener/types";
import { logEvent } from "@/lib/analytics";
import { useToast } from "@/hooks/useToast";
import Toast from "@/components/Toast";
import LeadForm from "./LeadForm";
import Image from "next/image";
import { MagicLinkDialog } from "@/components/auth/MagicLinkDialog";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { type UiQuestion } from "@/lib/screener/types";
import { Input } from "@/components/ui/input";

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

// Placeholder alternate trials - in real app would come from props or API
const ALTERNATE_TRIALS = [
  { nct_id: "NCT98765", title: "Alternative Long COVID Treatment Study", condition: "Long COVID" },
  { nct_id: "NCT54321", title: "Post-Viral Fatigue Research Trial", condition: "Post-viral syndrome" },
  { nct_id: "NCT11111", title: "Chronic Fatigue Intervention Study", condition: "Chronic fatigue" }
];

export default function ScreenResult({ trial, answers: initialAnswers, evaluation, optionalQuestions = [], uiVariant = "default" }: ScreenResultProps) {
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);
  const isDev = process.env.NODE_ENV === 'development';
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showAlternateTrials, setShowAlternateTrials] = useState(false);
  const hasLoggedUnknownEvent = useRef(false);
  const { toasts, addToast, removeToast } = useToast();
  const isCompactUI = uiVariant === "compact";
  const { user } = useSupabaseAuth();
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [alertsBusy, setAlertsBusy] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [magicLinkOpen, setMagicLinkOpen] = useState(false);

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

  const {
    result,
    score,
    met_details = [],
    unknown_details = [],
    unmet_details = [],
    reasons = [],
  } = evaluation;

  // Filter out pregnancy/breastfeeding from unknown_details for males
  const sexAnswer = answers.sex ?? answers.gender ?? answers.dem_sex ?? answers.sex_at_birth;
  const isMale = typeof sexAnswer === 'string' && sexAnswer.toLowerCase() === 'male';

  const filteredUnknownDetails = isMale
    ? unknown_details.filter((detail) => {
      const labelLower = (detail.label ?? '').toLowerCase();
      const idLower = (detail.id ?? '').toLowerCase();
      const combined = labelLower + ' ' + idLower;
      return !combined.includes('pregnan') && !combined.includes('breastfeed') && !combined.includes('nursing') && !combined.includes('lactating');
    })
    : unknown_details;

  const highlightedMet = met_details.slice(0, 4);
  const highlightedUnknown = filteredUnknownDetails.slice(0, 5);
  const highlightedUnmet = unmet_details.slice(0, 5);

  const remainingMet = Math.max(met_details.length - highlightedMet.length, 0);
  const remainingUnknown = Math.max(filteredUnknownDetails.length - highlightedUnknown.length, 0);
  const remainingUnmet = Math.max(unmet_details.length - highlightedUnmet.length, 0);
  const clinicCheckCount = filteredUnknownDetails.filter((detail) => detail.sourceTag === SourceTag.Clinic).length;

  // Determine badge styling and content
  const getBadgeConfig = () => {
    switch (result) {
      case 'likely':
        return {
          variant: 'default' as const,
          className: getStatusColors('likely').full,
          icon: CheckCircle,
          text: 'Likely match'
        };
      case 'possible':
        return {
          variant: 'secondary' as const,
          className: getStatusColors('possible').full,
          icon: AlertTriangle,
          text: 'Possible match'
        };
      case 'no':
        return {
          variant: 'outline' as const,
          className: getStatusColors('no').full,
          icon: XCircle,
          text: 'Not a match'
        };
    }
  };

  const badgeConfig = getBadgeConfig();
  const BadgeIcon = badgeConfig.icon;

  // Get explanation text based on result
  const getExplanation = () => {
    switch (result) {
      case 'likely':
        return "Based on your responses, you appear to meet the key eligibility criteria for this study.";
      case 'possible':
        return "You may qualify for this study, though some criteria need further evaluation by the research team.";
      case 'no':
        return "Based on your responses, you may not meet the current eligibility requirements for this study.";
    }
  };

  // Handle lead form submission
  const handleLeadFormSubmitted = (leadId: string) => {
    if (isDev) {
      console.log('Lead submitted with ID:', leadId);
    }
    // In real app: redirect to confirmation page, track conversion, etc.
  };

  const getCardStyles = () => {
    switch (result) {
      case 'likely': return "border-l-4 border-l-emerald-500 shadow-sm";
      case 'possible': return "border-l-4 border-l-amber-500 shadow-sm";
      default: return "border-l-4 border-l-slate-300 shadow-sm";
    }
  };

  // Safe Math.min for number array
  const safeMin = (...args: number[]) => Math.min(...args);

  const getConfidenceLevel = () => {
    if (score >= 90) return { label: "Excellent Match", color: "bg-emerald-500", track: "bg-emerald-100" };
    if (score >= 70) return { label: "Good Match", color: "bg-emerald-500", track: "bg-emerald-100" };
    if (score >= 50) return { label: "Fair Match", color: "bg-amber-500", track: "bg-amber-100" };
    return { label: "Low Match", color: "bg-slate-300", track: "bg-slate-100" };
  };

  const confidence = getConfidenceLevel();

  const getQuickSummary = () => {
    if (result === 'likely') return "You match the key requirements for this study!";
    if (result === 'possible') return "You match most criteria, but we need to check a few things.";
    return "This study might not be the best fit right now.";
  };

  const selectAnswerValue = (...keys: string[]) => {
    for (const key of keys) {
      const value = answers[key];
      if (value !== undefined && value !== null) {
        return value;
      }
    }
    return undefined;
  };

  const deriveAge = () => {
    const candidate = selectAnswerValue("age", "age_years", "patient_age");
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return Math.round(candidate);
    }
    if (typeof candidate === "string") {
      const parsed = Number(candidate.trim());
      if (Number.isFinite(parsed)) {
        return Math.round(parsed);
      }
    }
    return null;
  };

  const deriveSex = () => {
    const candidate = selectAnswerValue("sex", "gender");
    if (typeof candidate === "string") {
      const normalized = candidate.trim();
      if (normalized) {
        return normalized;
      }
    }
    return null;
  };

  const formatUnmetLabel = (label: string, clauseType: string) => {
    if (clauseType === "exclusion") {
      return `Exclusion: ${label}`;
    }
    return `Needs: ${label}`;
  };

  const handleCopySummary = async () => {
    const age = deriveAge();
    const sexRaw = deriveSex();
    const sex = sexRaw ? sexRaw.charAt(0).toUpperCase() + sexRaw.slice(1) : null;

    const lines: string[] = [`Trial ${trial.nct_id}`];

    if (age !== null || sex) {
      const participantParts: string[] = [];
      if (age !== null) {
        participantParts.push(`Age ${age}`);
      }
      if (sex) {
        participantParts.push(`Sex ${sex}`);
      }
      lines.push(`Participant: ${participantParts.join(", ")}`);
    }

    lines.push("Met criteria:");
    if (met_details.length > 0) {
      met_details.forEach((detail) => {
        lines.push(`- ${detail.label}`);
      });
    } else {
      lines.push("- None listed");
    }

    lines.push("Unmet criteria:");
    if (unmet_details.length > 0) {
      unmet_details.forEach((detail) => {
        lines.push(`- ${formatUnmetLabel(detail.label, detail.clauseType)}`);
      });
    } else {
      lines.push("- None noted");
    }

    lines.push(`Clinic checks needed: ${clinicCheckCount}`);

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
    } catch (error) {
      console.error("copy summary failed", error);
      addToast("Could not copy summary", "error");
    }
  };

  const handleAlertToggle = async () => {
    if (alertsBusy) {
      return;
    }

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

  return (
    <>
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>

      <div className="w-full space-y-4">
        {/* Main Result Card */}
        <Card className={cn("bg-white overflow-hidden rounded-none transition-all", getCardStyles())}>
          <CardHeader className="pb-2 pt-6">
            {/* Title Removed as per plan - strictly focusing on Match Status in card header if needed, but we do that in content now.
                Actually plan said "Use the card header for the Match Status".
                But we put purely content in CardContent for better flow.
                We can keep CardHeader for a very high level status label or remove it to save space.
                Let's remove redundant title blocks. */}
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Quick Summary Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 flex-1">
                <h3 className="text-lg font-semibold text-foreground">
                  {getQuickSummary()}
                </h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className={cn("font-medium",
                    result === 'likely' ? "text-emerald-700" :
                      result === 'possible' ? "text-amber-700" : "text-muted-foreground"
                  )}>
                    {confidence.label}
                  </span>
                  <span>•</span>
                  <span className="font-mono text-xs">{trial.nct_id}</span>
                  <span>•</span>
                  <button
                    onClick={handleCopySummary}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    <Share2 className="h-3 w-3" />
                    Share
                  </button>
                </div>
              </div>

              {/* Primary Action (moved to top) */}
              <div className="flex-shrink-0">
                {result !== 'no' && (
                  <Button
                    onClick={() => setShowLeadForm(true)}
                    className={cn(
                      "shadow-sm",
                      result === 'likely' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"
                    )}
                    size="sm"
                  >
                    {result === 'likely' ? "Connect now" : "Get evaluated"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Step Pills - Check Progress Visual */}
            {(() => {
              const totalChecks = met_details.length + unmet_details.length + filteredUnknownDetails.length;
              const passedChecks = met_details.length;
              const maxPills = Math.min(totalChecks, 10); // Cap at 10 visible pills

              if (totalChecks === 0) return null;

              return (
                <div className="flex items-center gap-3 py-3 border-b border-slate-100">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: maxPills }).map((_, i) => {
                      const isPassed = i < passedChecks;
                      const isUnmet = i >= passedChecks && i < passedChecks + unmet_details.length;
                      // Remaining are unknown/pending
                      return (
                        <div
                          key={i}
                          className={cn(
                            "h-2 w-2 rounded-full transition-all",
                            isPassed && "bg-emerald-500",
                            isUnmet && "bg-amber-500",
                            !isPassed && !isUnmet && "bg-slate-200"
                          )}
                        />
                      );
                    })}
                    {totalChecks > 10 && (
                      <span className="text-xs text-slate-400 ml-1">+{totalChecks - 10}</span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-slate-600">
                    {passedChecks} of {totalChecks} checks passed
                  </span>
                </div>
              );
            })()}

            <div className="space-y-4">
              {highlightedMet.length > 0 && (
                <div className="space-y-3 pt-4 first:pt-0">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                      <Check className="h-4 w-4" />
                      Matches Criteria
                    </h4>
                    <span className="text-[10px] font-bold uppercase text-emerald-600/80 bg-emerald-50 px-2 py-0.5 rounded-none">
                      {met_details.length} Items {remainingMet > 0 && `+ ${remainingMet} more`}
                    </span>
                  </div>
                  <ul className="space-y-2 text-sm text-slate-700">
                    {highlightedMet.map((detail) => (
                      <li key={detail.id} className="flex items-start gap-3">
                        <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span>{detail.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Unknowns Section - Strip Styling */}
              {highlightedUnknown.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-slate-100/60">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="text-sm font-semibold text-sky-700 flex items-center gap-2">
                      <HelpCircle className="h-4 w-4" />
                      Requires Confirmation
                    </h4>
                    <span className="text-[10px] font-bold uppercase text-sky-600/80 bg-sky-50 px-2 py-0.5 rounded-none">
                      {filteredUnknownDetails.length} Items
                    </span>
                  </div>
                  <ul className="space-y-2 text-sm text-slate-700">
                    {highlightedUnknown.map((detail) => (
                      <li key={detail.id} className="flex items-center justify-between gap-2 border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                        <div className="flex items-start gap-3">
                          <HelpCircle className="h-4 w-4 text-sky-400 mt-0.5 flex-shrink-0" />
                          <span>{detail.label}</span>
                        </div>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-slate-300 hover:text-sky-500 transition-colors" />
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs font-sans">
                            <p>{detail.sourceTag === SourceTag.Clinic ? "The clinic team will review this with you." : "Share more detail if you can."}</p>
                          </TooltipContent>
                        </Tooltip>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Unmet Section - Strip Styling */}
              {highlightedUnmet.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-slate-100/60">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="text-sm font-semibold text-amber-700/90 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Criteria to Discuss
                    </h4>
                    <span className="text-[10px] font-bold uppercase text-amber-600/80 bg-amber-50 px-2 py-0.5 rounded-none">
                      {unmet_details.length} Items
                    </span>
                  </div>
                  <ul className="space-y-2 text-sm text-slate-700">
                    {highlightedUnmet.map((detail) => (
                      <li key={detail.id} className="flex items-center justify-between gap-2 border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                        <div className="flex items-start gap-3">
                          <XCircle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                          <span className="flex-1">
                            {detail.clauseType === "exclusion" ? `May exclude: ${detail.label}` : `We still need: ${detail.label}`}
                          </span>
                        </div>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-slate-300 hover:text-amber-500 transition-colors" />
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs font-sans">
                            <p>
                              {detail.clauseType === "exclusion"
                                ? "This looks like an exclusion the study team will review."
                                : "This requirement didn’t match your answers yet."}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {reasons.length > 0 && (
                <div className="rounded-none border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
                  {reasons.slice(0, 3).map((reason, index) => (
                    <div key={`${reason}-${index}`}>• {reason}</div>
                  ))}
                </div>
              )}

              {/* Optional questions accordion on the results screen */}
              {optionalQuestions.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/40">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="optional" className="border-none">
                      <AccordionTrigger className="text-sm font-semibold text-blue-800 hover:text-blue-900 hover:no-underline py-2 bg-blue-50/50 px-3 rounded-none">
                        <span className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-none bg-blue-200 text-blue-800 text-xs font-bold">
                            {optionalQuestions.length}
                          </span>
                          Improve your match confidence
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4 px-1">
                        <div className="space-y-6">
                          <p className="text-xs text-muted-foreground mb-4">
                            Answer these additional questions to give the study team more detail and potentially increase your eligibility score.
                          </p>
                          {optionalQuestions.map((question) => (
                            <div key={question.id} className="space-y-2 pb-4 border-b border-border/40 last:border-0 last:pb-0">
                              <label className="text-sm font-medium text-foreground">
                                {question.label}
                              </label>
                              {question.kind === 'choice' ? (
                                <div className="flex flex-wrap gap-2">
                                  {question.options?.map((option) => (
                                    <button
                                      key={option}
                                      onClick={() => setAnswers(prev => ({ ...prev, [question.id]: option }))}
                                      className={cn(
                                        "px-3 py-2 text-sm rounded-none border transition",
                                        answers[question.id] === option
                                          ? "border-blue-500 bg-blue-100 text-blue-800"
                                          : "border-border bg-white text-muted-foreground hover:bg-muted"
                                      )}
                                    >
                                      {option}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <Input
                                  type={question.kind === 'number' ? 'number' : 'text'}
                                  //@ts-ignore - answers value might be anything
                                  value={answers[question.id] || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setAnswers(prev => ({ ...prev, [question.id]: question.kind === 'number' ? (val === "" ? undefined : Number(val)) : val }));
                                  }}
                                  className="max-w-xs"
                                  placeholder={question.kind === 'number' ? "Enter value..." : "Type here..."}
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

            {/* Alerts Toggle - moved here */}
            <div className="rounded-none border border-border/60 bg-white/70 p-4 mt-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Get alerts like this</p>
                  <p className="text-xs text-muted-foreground">
                    Save your preferences to hear about similar studies.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    We’ll email at most once per week. You can stop anytime.
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
                    "relative inline-flex h-6 w-11 items-center rounded-none transition",
                    alertsEnabled ? "bg-emerald-500" : "bg-muted",
                    alertsBusy ? "cursor-wait opacity-60" : "cursor-pointer"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-5 w-5 transform rounded-none bg-white shadow transition",
                      alertsEnabled ? "translate-x-5" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
              {alertsError && <p className="mt-3 text-xs text-red-600">{alertsError}</p>}
            </div>

            {/* Primary CTA Flow */}
            {result === 'likely' && !showLeadForm && (
              <div className="pt-2">
                <Button
                  onClick={() => setShowLeadForm(true)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  size="lg"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Connect with research team
                </Button>
              </div>
            )}

            {result === 'possible' && !showLeadForm && (
              <div className="pt-2 space-y-3">
                <p className="text-sm text-muted-foreground">
                  The research team can provide a full evaluation to determine your eligibility.
                </p>
                <Button
                  onClick={() => setShowLeadForm(true)}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                  size="lg"
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Get evaluated by research team
                </Button>
              </div>
            )}

            {result === 'no' && (
              <div className="pt-2 space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-none">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">
                    Don’t lose hope!
                  </h4>
                  <p className="text-sm text-blue-700">
                    Eligibility criteria can change, and there may be other studies that are a better fit for you.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowAlternateTrials(!showAlternateTrials)}
                    className="flex-1"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    See similar trials
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowLeadForm(true)}
                    className="flex-1"
                  >
                    Still interested?
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alternate Trials (for 'no' result) */}
        {result === 'no' && showAlternateTrials && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Similar Studies You Might Qualify For</CardTitle>
              <p className="text-sm text-muted-foreground">
                These trials have similar focus areas and may have different eligibility criteria.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {ALTERNATE_TRIALS.slice(0, 3).map((altTrial) => (
                <div
                  key={altTrial.nct_id}
                  className="flex items-center justify-between p-3 border rounded-none hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium line-clamp-1">
                      {altTrial.title}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {altTrial.condition} • {altTrial.nct_id}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="pt-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.location.href = '/trials'}
                >
                  Browse all trials
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lead Form */}
        {showLeadForm && (
          <LeadForm
            nct_id={trial.nct_id}
            trial_title={trial.title}
            condition={trial.condition}
            match_result={
              result === 'likely' ? 'qualifies' :
                result === 'possible' ? 'possible' :
                  'not_qualified'
            }
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
            onSubmitted={handleLeadFormSubmitted}
          />
        )}
        <MagicLinkDialog open={magicLinkOpen} onOpenChange={setMagicLinkOpen} />
      </div>
    </>
  );
}

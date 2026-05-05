"use client";
import { useEffect, useRef, useState } from "react";
import SkeletonCard from "../SkeletonCard";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { screenerHref } from '@/lib/urls';
import { logEvent } from '@/lib/analytics';
import { evaluateTrial, type EvaluationResult } from '@/lib/matching/evaluator';
import { getChipClasses } from '@/shared/colors';
import type { PatientProfile } from '@/shared/match/types';

type ShortlistTrial = {
  nct_id: string;
  title: string;
  sponsor?: string;
  phase?: string;
  status?: string;
  criteria_json?: unknown;
  condition_slugs?: string[];
  original_conditions?: string[];
  site_count?: number;
  distance_km?: number;
  enrollment?: number;
  gender?: string | null;
  min_age_years?: number | null;
  max_age_years?: number | null;
  why?: string[];
};

type EvaluatedTrial = ShortlistTrial & {
  __idx: number;
  evaluation?: EvaluationResult;
  confidence?: number;
  unmet_inclusion?: string[];
  triggered_exclusion?: string[];
};

type AnswersState = {
  diagnosis_confirmed?: boolean;
  willing_miles: number;
  willing_km: number;
};

type ShortlistProps = {
  trials: ShortlistTrial[];
  onBack: () => void;
  onSelect?: (trial: ShortlistTrial) => void;
  patientProfile: Partial<PatientProfile>;
  onError: (message: string) => void;
};

export default function Shortlist({ trials, onBack, onSelect, patientProfile, onError }: ShortlistProps) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [displayTrials, setDisplayTrials] = useState<EvaluatedTrial[]>(() => trials.map((t, i) => ({ ...t, __idx: i })));
  const prefillCondition = patientProfile?.conditions?.[0] || null;
  const prefill = {
    condition: prefillCondition,
    age: patientProfile?.age ?? undefined,
    sex: patientProfile?.sex ?? undefined,
    zip: patientProfile?.location?.zip ?? undefined,
  };
  const [answers, setAnswers] = useState<AnswersState>({
    diagnosis_confirmed: undefined,
    willing_miles: patientProfile?.willingness_to_travel_miles ?? 0,
    willing_km: Math.round((patientProfile?.willingness_to_travel_miles ?? 0) * 1.60934)
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Fire once on mount
    try {
      logEvent('results_shown', {
        condition: patientProfile?.conditions?.[0] || null,
        age: patientProfile?.age ?? null,
        sex: patientProfile?.sex ?? null,
        miles: patientProfile?.willingness_to_travel_miles ?? null,
        count: displayTrials?.length || 0,
      });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-evaluate and sort when answers change (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        const evaluated: EvaluatedTrial[] = trials.map((trial, i) => {
          // Build a lightweight criteria object if missing
          const cj = trial.criteria_json && (Array.isArray(trial.criteria_json) || typeof trial.criteria_json === 'object')
            ? trial.criteria_json
            : {
                required_sex: trial.gender ? String(trial.gender).toLowerCase() : undefined,
                min_age: typeof trial.min_age_years === 'number' ? trial.min_age_years : undefined,
                max_age: typeof trial.max_age_years === 'number' ? trial.max_age_years : undefined,
                conditions: Array.isArray(trial.original_conditions) ? trial.original_conditions : [],
                inclusion: [],
                exclusion: []
              };

          const evaluation = evaluateTrial(
            cj,
            { ...prefill, ...answers },
            {
              criteriaNorm: cj,
              trial: {
                nct_id: trial.nct_id,
                min_age_years: trial.min_age_years ?? null,
                max_age_years: trial.max_age_years ?? null,
                gender: trial.gender ?? null,
              },
              profile: {
                conditions: Array.isArray(trial.condition_slugs)
                  ? trial.condition_slugs
                  : Array.isArray(trial.original_conditions)
                  ? trial.original_conditions
                  : [],
              },
            }
          );
          return {
            ...trial,
            __idx: i,
            evaluation,
            confidence: evaluation.score,
            unmet_inclusion: evaluation.unmet_includes,
            triggered_exclusion: evaluation.triggered_excludes,
          };
        });

        evaluated.sort((a, b) => {
          const as = a.confidence ?? 0;
          const bs = b.confidence ?? 0;
          if (bs !== as) return bs - as;
          const asc = a.site_count ?? 0;
          const bsc = b.site_count ?? 0;
          if (bsc !== asc) return bsc - asc;
          return (a.__idx ?? 0) - (b.__idx ?? 0);
        });

        setDisplayTrials(evaluated);
      } catch (e) {
        setDisplayTrials(trials.map((t, i) => ({ ...t, __idx: i })));
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, trials]);

  function handleDiagnosisChange(val: boolean) {
    setAnswers(prev => ({ ...prev, diagnosis_confirmed: val }));
  }

  function handleMilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const miles = Math.max(0, Number(e.target.value || 0));
    setAnswers(prev => ({ ...prev, willing_miles: miles, willing_km: Math.round(miles * 1.60934) }));
  }

  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Mock API call for email notification
      await new Promise(resolve => setTimeout(resolve, 1000));
      onError("Email notification set up successfully!");
    } catch (error) {
      onError("Failed to set up notifications. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (trials.length === 0) {
    return (
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold text-pm-ink">No perfect matches found</h2>
          <button 
            onClick={onBack} 
            className="text-sm text-pm-secondary hover:text-pm-secondaryHover underline transition-colors duration-200"
          >
            Back
          </button>
        </div>
        <div className="mt-6 bg-white border border-pm-border rounded-2xl p-6 shadow-soft">
          <h3 className="font-heading font-semibold text-lg mb-4 text-pm-ink">Here are the closest trials</h3>
          <div className="space-y-4">
            <div className="group bg-gradient-to-r from-pm-bg/50 to-white border border-pm-border/60 rounded-xl p-4 transition-all duration-200 hover:border-pm-secondary/30 hover:shadow-sm">
              <h4 className="font-medium text-pm-ink group-hover:text-pm-secondary transition-colors duration-200">Long COVID Fatigue Study</h4>
              <p className="text-sm text-pm-muted mt-1">Sanofi • Phase 2 • 25km away</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={getChipClasses('status', 'partial')}>
                  Age slightly outside range
                </span>
                <span className={getChipClasses('status', 'matches')}>
                  Diagnosis matches
                </span>
              </div>
            </div>
            <div className="group bg-gradient-to-r from-pm-bg/50 to-white border border-pm-border/60 rounded-xl p-4 transition-all duration-200 hover:border-pm-secondary/30 hover:shadow-sm">
              <h4 className="font-medium text-pm-ink group-hover:text-pm-secondary transition-colors duration-200">Fibromyalgia Pain Study</h4>
              <p className="text-sm text-pm-muted mt-1">Academic Center • Phase 2 • 40km away</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={getChipClasses('status', 'different')}>
                  Different condition
                </span>
                <span className={getChipClasses('status', 'matches')}>
                  Age matches
                </span>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-pm-border/60">
            <h4 className="font-medium mb-3 text-pm-ink">Get notified when eligibility changes</h4>
            <form onSubmit={handleEmailSubmit} className="flex gap-3">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 rounded-xl border border-pm-border/60 p-3 text-sm focus:border-pm-secondary focus:ring-2 focus:ring-pm-secondary/20 transition-all duration-200"
                required
                aria-label="Email for trial notifications"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-pm-primary text-white px-6 py-3 text-sm font-medium hover:bg-pm-primaryHover disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-soft hover:shadow-lg"
                aria-label="Subscribe to trial notifications"
              >
                {loading ? "Subscribing..." : "Notify me"}
              </button>
            </form>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold text-pm-ink">Your matches</h2>
        <button 
          onClick={onBack} 
          className="text-sm text-pm-secondary hover:text-pm-secondaryHover underline transition-colors duration-200" 
          aria-label="Go back to previous step"
        >
          Back
        </button>
      </div>
      {/* Micro-questions panel */}
      <div className="mt-6 bg-white border border-pm-border/60 rounded-2xl p-4 shadow-soft">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Diagnosis */}
          <div>
            <Label className="block text-sm font-medium text-pm-ink">
              Diagnosed with {prefillCondition || 'this condition'} by a clinician?
            </Label>
            <div className="mt-2 flex items-center gap-4" role="radiogroup" aria-label="Diagnosis confirmed">
              <Label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="diagnosis_confirmed"
                  value="yes"
                  checked={answers.diagnosis_confirmed === true}
                  onChange={() => handleDiagnosisChange(true)}
                />
                Yes
              </Label>
              <Label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="diagnosis_confirmed"
                  value="no"
                  checked={answers.diagnosis_confirmed === false}
                  onChange={() => handleDiagnosisChange(false)}
                />
                No
              </Label>
            </div>
          </div>

          {/* Travel miles */}
          <div>
            <Label className="block text-sm font-medium text-pm-ink">
              Willing to travel (miles)
            </Label>
            <input
              type="number"
              min={0}
              step={5}
              value={answers.willing_miles}
              onChange={handleMilesChange}
              className="mt-2 w-full rounded-xl border border-pm-border p-2"
              aria-label="Willing to travel in miles"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 grid sm:grid-cols-2 gap-6">
        {displayTrials.map(t => (
          <div 
            key={t.nct_id} 
            className="group bg-white border border-pm-border/60 rounded-2xl p-6 shadow-soft flex flex-col transition-all duration-300 hover:shadow-lg hover:border-pm-secondary/30 hover:-translate-y-1"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-2 flex-1 pr-4">
                <h3 className="font-heading flex-1 min-w-0 font-semibold text-lg leading-tight text-pm-ink group-hover:text-pm-secondary transition-colors duration-200">
                  {t.title}
                </h3>
                {(() => {
                  const confidence = t.confidence ?? 0;
                  const badge = confidence >= 70
                    ? { label: "Likely match", cls: "bg-pm-accent text-white" }
                    : confidence >= 40
                      ? { label: "Possible", cls: "bg-amber-500 text-white" }
                      : { label: "Unlikely", cls: "bg-muted text-foreground" };
                  return (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap flex-shrink-0 ${badge.cls}`}>
                      {badge.label}
                    </span>
                  );
                })()}
                {(() => {
                  const unmet = t.unmet_inclusion ?? [];
                  const excl = t.triggered_exclusion ?? [];
                  const hasWhy = (unmet.length + excl.length) > 0;
                  if (!hasWhy) return null;
                  return (
                    <span className="relative flex-shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="text-xs underline decoration-dotted text-pm-muted hover:text-pm-secondary">
                            Why?
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">
                          <div className="space-y-2">
                            {unmet.length > 0 && (
                              <div>
                                <div className="text-xs font-medium text-foreground mb-1">Couldn&apos;t confirm:</div>
                                <ul className="pl-4 list-disc space-y-0.5">
                                  {unmet.slice(0,3).map((id, i) => (
                                    <li key={i} className="text-xs text-pm-muted">{id}</li>
                                  ))}
                                </ul>
                                {unmet.length > 3 && (
                                  <div className="text-xs text-pm-muted">+{unmet.length - 3} more</div>
                                )}
                              </div>
                            )}
                            {excl.length > 0 && (
                              <div>
                                <div className="text-xs font-medium text-foreground mb-1">Potential exclusions:</div>
                                <ul className="pl-4 list-disc space-y-0.5">
                                  {excl.slice(0,3).map((id, i) => (
                                    <li key={i} className="text-xs text-pm-muted">{id}</li>
                                  ))}
                                </ul>
                                {excl.length > 3 && (
                                  <div className="text-xs text-pm-muted">+{excl.length - 3} more</div>
                                )}
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </span>
                  );
                })()}
              </div>
              <span className="text-xs bg-gradient-to-r from-pm-bg to-white border border-pm-border/60 rounded-xl px-3 py-1.5 font-medium text-pm-ink/80">
                {t.status} · {t.phase}
              </span>
            </div>
            
            <p className="text-sm text-pm-muted mb-4 font-medium">{t.sponsor}</p>
            
            <div className="flex flex-wrap gap-2 mb-6">
              {(t.why ?? []).map((w, i) => (
                <span 
                  key={i} 
                  className="text-xs bg-gradient-to-r from-pm-bg/80 to-white border border-pm-border/50 rounded-xl px-3 py-1.5 text-pm-ink/80 font-medium transition-all duration-200 hover:border-pm-secondary/40 hover:text-pm-secondary hover:shadow-sm"
                >
                  {w}
                </span>
              ))}
              <span className="text-xs bg-white border border-pm-border/60 rounded-xl px-3 py-1.5 text-pm-ink/80 font-medium">
                ~{t.distance_km} km
              </span>
              <span className="text-xs bg-white border border-pm-border/60 rounded-xl px-3 py-1.5 text-pm-ink/80 font-medium">
                {t.enrollment} participants
              </span>
            </div>
            
            <div className="mt-auto">
              <a 
                href={screenerHref({ nct_id: t.nct_id })}
                className="block w-full rounded-2xl bg-pm-accent text-white px-6 py-3 font-medium hover:bg-pm-accentHover transition-all duration-200 shadow-soft hover:shadow-lg hover:scale-105 text-center"
                aria-label={`Continue screening for ${t.title}`}
                aria-disabled={!t.nct_id || !t.criteria_json}
                onClick={(e) => { if (!t.nct_id || !t.criteria_json) e.preventDefault(); }}
              >
                {(!t.nct_id || !t.criteria_json) ? 'Not available' : 'Continue screening'}
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

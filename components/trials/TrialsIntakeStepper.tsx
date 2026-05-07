"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import type { ProfileCookie } from "@/shared/profileCookie";
import { updateProfileBatch, getConditionSuggestionsAction } from "@/app/actions";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Compass, Search, Loader2, Check, X } from "lucide-react";

type TrialsIntakeStepperProps = {
  profile: ProfileCookie | null;
  forceIntake?: boolean;
};

const STORAGE_KEY = "pm_trials_guided_intake_v1";
const DISTANCE_OPTIONS = [10, 25, 50, 100];

const STEPS = [
  { id: "condition", title: "Condition", helper: "What condition are you researching?" },
  { id: "location", title: "Location", helper: "Add your ZIP code to prioritize nearby sites." },
  { id: "age", title: "Age", helper: "Age helps remove obviously ineligible trials." },
  { id: "sex", title: "Sex", helper: "Some studies are sex-specific." },
  { id: "travel", title: "Travel", helper: "Set how far you are willing to travel." },
] as const;

function normalizeZip(value: string): string {
  return value.replace(/\D/g, "").slice(0, 5);
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline search input for conditions - direct typing with dropdown suggestions
// ─────────────────────────────────────────────────────────────────────────────
type ConditionSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

function ConditionSearchInput({ value, onChange, placeholder = "Type your condition..." }: ConditionSearchInputProps) {
  const [suggestions, setSuggestions] = useState<Array<{ slug: string; label: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedInput = useDebounce(value, 300);

  // Fetch suggestions
  useEffect(() => {
    async function fetchSuggestions() {
      if (!debouncedInput || debouncedInput.length < 2) {
        setSuggestions([]);
        return;
      }
      setIsLoading(true);
      try {
        const results = await getConditionSuggestionsAction(debouncedInput);
        setSuggestions(results);
      } catch (error) {
        console.error("Failed to fetch suggestions", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSuggestions();
  }, [debouncedInput]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (label: string) => {
    onChange(label);
    setIsFocused(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleNativeInput = (e: React.FormEvent<HTMLInputElement>) => {
    onChange(e.currentTarget.value);
  };

  const showDropdown = isFocused && (suggestions.length > 0 || isLoading);

  return (
    <div ref={containerRef} className="relative space-y-2">
      <Label htmlFor="guided-condition">Condition</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          id="guided-condition"
          value={value}
          onChange={handleInputChange}
          onInput={handleNativeInput}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          className="h-11 pl-10 pr-10"
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Suggestions dropdown */}
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-auto rounded-lg border border-border bg-white shadow-lg">
          {isLoading && suggestions.length === 0 ? (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          ) : (
            suggestions.map((s) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => handleSelect(s.label)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-muted/50",
                  value === s.label && "bg-emerald-50 text-emerald-800"
                )}
              >
                {value === s.label && <Check className="h-4 w-4 text-emerald-600" />}
                <span className={value === s.label ? "" : "pl-6"}>{s.label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function TrialsIntakeStepper({ profile, forceIntake: forceIntakeProp = false }: TrialsIntakeStepperProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const forceIntake = forceIntakeProp || searchParams.get("intake") === "1";
  const queryCondition = searchParams.get("condition") || searchParams.get("conditions") || "";
  const queryZip = searchParams.get("zip") || "";
  const queryAge = searchParams.get("age") || "";
  const querySex = searchParams.get("sex") || "";
  const queryRadius = searchParams.get("radius") || "";
  const hasQueryText = Boolean(searchParams.get("q"));
  const hasStatusFilter = Boolean(searchParams.get("status_bucket") || searchParams.get("status"));

  const [isHydrated, setIsHydrated] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(forceIntake);
  const [stepIndex, setStepIndex] = useState(0);

  const [condition, setCondition] = useState(queryCondition || profile?.conditions?.[0] || "");
  const [zip, setZip] = useState(queryZip || profile?.zip || "");
  const [age, setAge] = useState(queryAge || (profile?.age ? String(profile.age) : ""));
  const [sex, setSex] = useState(querySex || (profile?.sex === "male" || profile?.sex === "female" ? profile.sex : ""));
  const parsedRadius = Number.parseInt(queryRadius, 10);
  const [radius, setRadius] = useState(
    Number.isFinite(parsedRadius) && DISTANCE_OPTIONS.includes(parsedRadius)
      ? parsedRadius
      : profile?.radius && DISTANCE_OPTIONS.includes(profile.radius)
        ? profile.radius
        : 50,
  );

  useEffect(() => {
    setIsHydrated(true);
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") {
        setIsDismissed(true);
      }
    } catch {
      // Ignore browser storage issues.
    }
  }, []);

  useEffect(() => {
    if (!forceIntake) {
      return;
    }
    setIsExpanded(true);
    const nextRadius = Number.parseInt(queryRadius, 10);
    setStepIndex(0);
    setCondition(queryCondition || profile?.conditions?.[0] || "");
    setZip(queryZip || profile?.zip || "");
    setAge(queryAge || (profile?.age ? String(profile.age) : ""));
    setSex(querySex || (profile?.sex === "male" || profile?.sex === "female" ? profile.sex : ""));
    setRadius(
      Number.isFinite(nextRadius) && DISTANCE_OPTIONS.includes(nextRadius)
        ? nextRadius
        : profile?.radius && DISTANCE_OPTIONS.includes(profile.radius)
          ? profile.radius
          : 50,
    );
  }, [forceIntake, queryCondition, queryZip, queryAge, querySex, queryRadius, profile]);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(queryCondition || queryZip || queryAge || querySex || hasQueryText || hasStatusFilter),
    [queryCondition, queryZip, queryAge, querySex, hasQueryText, hasStatusFilter],
  );

  const hasExistingProfile = Boolean(
    (profile?.conditions && profile.conditions.length > 0) || profile?.zip || profile?.age || profile?.sex,
  );

  const isVisible =
    forceIntake || (isHydrated && !isDismissed && !hasActiveFilters && !hasExistingProfile);

  const canContinue = stepIndex === 0 ? condition.trim().length > 0 : true;
  const isLastStep = stepIndex === STEPS.length - 1;

  const markDismissed = () => {
    setIsDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore browser storage issues.
    }
  };

  const toTrialsHref = (params: URLSearchParams) => {
    const query = params.toString();
    return query ? `/trials?${query}` : "/trials";
  };

  const closeIntake = () => {
    markDismissed();
    setIsExpanded(false);
    if (forceIntake) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("intake");
      router.replace(toTrialsHref(params), { scroll: false });
    }
  };

  const handleApply = async () => {
    const params = new URLSearchParams(searchParams.toString());
    const normalizedZip = normalizeZip(zip);
    const parsedAge = Number.parseInt(age, 10);
    const normalizedCondition = condition.trim();

    if (normalizedCondition) {
      params.set("condition", normalizedCondition);
    } else {
      params.delete("condition");
    }
    params.delete("conditions");

    if (normalizedZip.length === 5) {
      params.set("zip", normalizedZip);
    } else {
      params.delete("zip");
    }

    if (Number.isFinite(parsedAge) && parsedAge >= 0 && parsedAge <= 120) {
      params.set("age", String(parsedAge));
    } else {
      params.delete("age");
    }

    if (sex === "male" || sex === "female") {
      params.set("sex", sex);
    } else {
      params.delete("sex");
    }

    params.set("radius", String(radius));
    params.delete("page");
    params.delete("prefill");
    params.delete("intake");

    try {
      await updateProfileBatch({
        age: Number.isFinite(parsedAge) && parsedAge >= 0 && parsedAge <= 120 ? parsedAge : undefined,
        sex: sex === "male" || sex === "female" ? sex : null,
        zip: normalizedZip.length === 5 ? normalizedZip : undefined,
        radius,
        conditions: normalizedCondition ? [normalizedCondition] : [],
      });
    } catch (error) {
      console.error("Failed to persist guided intake profile fields", error);
    }

    markDismissed();
    router.push(toTrialsHref(params));
  };

  if (!isVisible) {
    return null;
  }

  return (
    <section
      data-testid="trials-intake-stepper"
      data-hydrated={isHydrated ? "true" : "false"}
      className="mb-4 rounded-2xl border border-border/60 bg-white/90 shadow-sm"
    >
      <div className="flex flex-col gap-4 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
              <Compass className="h-3.5 w-3.5" />
              Personalize Results
            </div>
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Narrow this list before you open individual studies
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Add condition, ZIP, age, and sex to remove obvious mismatches. Detailed eligibility still happens on each trial&apos;s screening page.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isExpanded && (
              <Button type="button" variant="brand" className="h-9 px-4 text-sm" onClick={() => setIsExpanded(true)}>
                Personalize results
              </Button>
            )}
            <Button type="button" variant="ghost" className="h-9 px-3 text-xs" onClick={closeIntake}>
              {forceIntake ? "Back to results" : "Hide"}
            </Button>
          </div>
        </div>

        {!isExpanded ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-secondary px-3 py-1">Condition</span>
            <span className="rounded-full bg-secondary px-3 py-1">ZIP / distance</span>
            <span className="rounded-full bg-secondary px-3 py-1">Age</span>
            <span className="rounded-full bg-secondary px-3 py-1">Sex</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                {STEPS.map((s, i) => {
                  const isCompleted = i < stepIndex;
                  const isCurrent = i === stepIndex;
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "h-2 w-2 rounded-full transition-all",
                        isCompleted && "bg-emerald-500",
                        isCurrent && "scale-110 bg-primary",
                        !isCompleted && !isCurrent && "bg-slate-200",
                      )}
                    />
                  );
                })}
              </div>
              <span className="text-xs font-medium text-slate-500">
                Step {stepIndex + 1} of {STEPS.length}
              </span>
              <span className="text-xs text-muted-foreground">{STEPS[stepIndex].helper}</span>
            </div>

            <div className="rounded-xl border border-border/50 bg-background/70 p-4">
              <div className="min-h-[168px]">
                {stepIndex === 0 && (
                  <ConditionSearchInput
                    value={condition}
                    onChange={setCondition}
                    placeholder="Type your condition..."
                  />
                )}

                {stepIndex === 1 && (
                  <div className="space-y-2">
                    <Label htmlFor="guided-zip">ZIP code (optional)</Label>
                    <Input
                      id="guided-zip"
                      value={zip}
                      onChange={(event) => setZip(normalizeZip(event.target.value))}
                      placeholder="e.g. 02115"
                      inputMode="numeric"
                      maxLength={5}
                      className="h-11"
                    />
                    <p className="text-xs text-muted-foreground">Leave blank to search nationwide.</p>
                  </div>
                )}

                {stepIndex === 2 && (
                  <div className="space-y-2">
                    <Label htmlFor="guided-age">Age (optional)</Label>
                    <Input
                      id="guided-age"
                      type="number"
                      value={age}
                      onChange={(event) => setAge(event.target.value)}
                      min={0}
                      max={120}
                      placeholder="Your age"
                      className="h-11 max-w-[180px]"
                    />
                  </div>
                )}

                {stepIndex === 3 && (
                  <div className="space-y-3">
                    <Label>Sex at birth (optional)</Label>
                    <RadioGroup value={sex} onValueChange={setSex} className="flex flex-wrap gap-5">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem id="guided-sex-any" value="" />
                        <Label htmlFor="guided-sex-any" className="cursor-pointer text-sm font-normal">
                          Any
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem id="guided-sex-male" value="male" />
                        <Label htmlFor="guided-sex-male" className="cursor-pointer text-sm font-normal">
                          Male
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem id="guided-sex-female" value="female" />
                        <Label htmlFor="guided-sex-female" className="cursor-pointer text-sm font-normal">
                          Female
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {stepIndex === 4 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Travel distance</Label>
                      <span className="text-sm font-semibold text-primary">{radius} miles</span>
                    </div>
                    <Slider
                      value={[Math.max(0, DISTANCE_OPTIONS.indexOf(radius))]}
                      min={0}
                      max={DISTANCE_OPTIONS.length - 1}
                      step={1}
                      onValueChange={(values) => setRadius(DISTANCE_OPTIONS[values[0]])}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      {DISTANCE_OPTIONS.map((option) => (
                        <span key={option}>{option}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1"
                  onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
                  disabled={stepIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>

                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" className="gap-1" onClick={() => setIsExpanded(false)}>
                    <X className="h-4 w-4" />
                    Collapse
                  </Button>
                  <Button
                    type="button"
                    variant="brand"
                    className="gap-1"
                    disabled={!canContinue}
                    onClick={() => {
                      if (isLastStep) {
                        void handleApply();
                        return;
                      }
                      setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
                    }}
                  >
                    {isLastStep ? "Apply filters" : "Next"}
                    {!isLastStep && <ChevronRight className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

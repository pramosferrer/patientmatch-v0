"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HeroTrialPreview } from "@/components/marketing/HeroTrialPreview";
import { MapUSA } from "@/components/marketing/MapUSA";
import AuroraBG from "@/components/AuroraBG";
import { toConditionSlug } from "@/shared/conditions-normalize";
import { track } from "@/lib/analytics";
import { ConditionCombobox } from "@/components/ConditionCombobox";
import { Search, MapPin } from "lucide-react";

const POPULAR_CONDITIONS = ["Long COVID", "Migraine", "Obesity", "Diabetes"];

const POPULAR_LINKS = POPULAR_CONDITIONS.map((name) => ({
  label: name,
  href: `/trials?condition=${encodeURIComponent(name)}`,
}));

export default function Hero() {
  const router = useRouter();
  const [condition, setCondition] = useState("");
  const [zip, setZip] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedCondition = condition.trim();
    const trimmedZip = zip.trim();

    if (!trimmedCondition) {
      setError("Enter a condition to get started.");
      return;
    }

    if (!/^\d{5}$/.test(trimmedZip)) {
      setError("ZIP code must be 5 digits.");
      return;
    }

    setError(null);

    const conditionSlug = toConditionSlug(trimmedCondition);
    track.hero_search_submit({
      condition_slug: conditionSlug,
      zip3: trimmedZip.slice(0, 3),
    });

    try {
      const payload = JSON.stringify({
        conditions: [trimmedCondition],
        zip: trimmedZip,
      });
      window.sessionStorage.setItem("pm_profile", payload);
    } catch {
      /* ignore storage errors */
    }

    try {
      await fetch("/api/profile/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conditions: [trimmedCondition],
          zip: trimmedZip,
        }),
      });
    } catch {
      /* ignore network errors */
    }

    const params = new URLSearchParams({
      condition: trimmedCondition,
      zip: trimmedZip,
    });
    router.push(`/trials?${params.toString()}`);
  };

  return (
    <section className="pm-section relative overflow-hidden" aria-labelledby="hero-heading">
      <AuroraBG className="absolute inset-0 -z-20 opacity-95" intensity="default" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-r from-white/80 via-white/55 to-white/20"
      />
      <div className="pm-container relative">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center">
          <div className="flex flex-col gap-6 lg:self-center">
            <h1 id="hero-heading" className="pm-heading-1 text-balance text-foreground">
              Find clinical trials that fit your life.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl">
              Instantly match with recruiting studies. Enter your condition to check eligibility
              and view sites near you.
            </p>
            <form onSubmit={handleSubmit} className="mt-4 relative z-10 w-full max-w-md">
              <div className="bg-white p-2 rounded-none shadow-xl shadow-stone-200/50 border border-stone-100 flex flex-col gap-2 w-full border-t-4 border-t-rose-500">
                {/* Row 1: Condition - Gets full attention */}
                <div className="relative w-full group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground z-10 pointer-events-none group-focus-within:text-rose-500 transition-colors">
                    <Search className="w-4 h-4" />
                  </div>
                  <Label htmlFor="hero-condition" className="sr-only">
                    Condition
                  </Label>
                  <ConditionCombobox
                    value={condition}
                    onChange={(val) => {
                      setCondition(val);
                      if (error) setError(null);
                    }}
                    placeholder="Condition (e.g., Migraine)"
                    className="h-12 border-0 bg-stone-50/50 hover:bg-stone-100/80 transition-colors shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-4 pl-11 text-base placeholder:text-stone-400 w-full justify-between !rounded-none"
                  />
                </div>

                {/* Row 2: Location + Action */}
                <div className="flex gap-2">
                  <div className="relative w-32 shrink-0 group">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground z-10 pointer-events-none group-focus-within:text-rose-500 transition-colors">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <Label htmlFor="hero-zip" className="sr-only">
                      ZIP code
                    </Label>
                    <Input
                      id="hero-zip"
                      value={zip}
                      onChange={(event) => {
                        const next = event.target.value.replace(/\D/g, "");
                        setZip(next);
                        if (error) setError(null);
                      }}
                      placeholder="Zip"
                      className="pl-10 h-12 bg-stone-50/50 border-0 border-transparent hover:bg-stone-100/80 transition-colors shadow-none focus-visible:ring-2 focus-visible:ring-rose-500/20 focus-visible:ring-offset-0 rounded-none"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={5}
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="flex-1 h-12 bg-rose-500 hover:bg-rose-600 text-white !rounded-none font-semibold shadow-md transition-all active:scale-[0.98]"
                  >
                    See matches
                  </Button>
                </div>
              </div>

              {error && (
                <div className="absolute top-[calc(100%+0.5rem)] left-0 px-4">
                  <p className="text-sm font-medium text-destructive animate-in fade-in slide-in-from-top-1">
                    {error}
                  </p>
                </div>
              )}

              <div className="mt-4 flex items-center gap-2 px-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-400/80">
                  Searching 1.4M+ sites · Data refreshed daily.
                </p>
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground pt-4">
              <span className="font-medium text-foreground mr-1">Popular:</span>
              {POPULAR_LINKS.map((condition) => (
                <Link
                  key={condition.label}
                  href={condition.href}
                  className="
                    inline-flex items-center justify-center rounded-none px-2 py-1 
                    text-sm font-medium text-stone-600 transition-colors 
                    hover:text-rose-600 hover:bg-rose-50/50
                  "
                >
                  {condition.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="relative flex h-full flex-col justify-center lg:self-stretch lg:pl-4 xl:pl-8 -mt-12">
            <div className="relative flex-1 lg:pl-4 lg:pr-4">
              <div className="h-[360px] w-full sm:h-[420px] lg:h-full lg:min-h-[470px] lg:rounded-[2.5rem]">
                <MapUSA className="h-full w-full" activeRegion="NE" />
              </div>
              <HeroTrialPreview className="mt-6 w-full sm:max-w-xl lg:mt-0 lg:absolute lg:left-1/2 lg:bottom-0 lg:w-[min(620px,calc(100%+48px))] lg:max-w-[640px] lg:-translate-x-1/2 xl:max-w-[680px]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

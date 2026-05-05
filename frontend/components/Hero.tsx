"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuroraBG from "@/components/AuroraBG";
import { toConditionSlug } from "@/shared/conditions-normalize";
import { track } from "@/lib/analytics";
import { ConditionCombobox } from "@/components/ConditionCombobox";
import { Search, MapPin } from "lucide-react";

const CONDITIONS = [
  { name: "Long COVID",        color: "#047857" },
  { name: "Migraine",          color: "#6D28D9" },
  { name: "Type 2 Diabetes",   color: "#0E7490" },
  { name: "Obesity",           color: "#D97706" },
  { name: "Depression",        color: "#2563EB" },
  { name: "Parkinson's",       color: "#7C3AED" },
  { name: "Breast Cancer",     color: "#BE185D" },
  { name: "COPD",              color: "#059669" },
  { name: "Anxiety Disorders", color: "#0891B2" },
];

function ConditionList() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="flex flex-col">
      {CONDITIONS.map((c, i) => (
        <Link
          key={c.name}
          href={`/conditions/${toConditionSlug(c.name)}`}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          className="flex items-center justify-between gap-4 py-[15px] no-underline transition-all duration-150 rounded-lg"
          style={{
            borderBottom: `1px solid ${hovered === i ? "rgba(45,155,112,0.2)" : "rgba(215,210,201,0.42)"}`,
            background: hovered === i ? "rgba(45,155,112,0.03)" : "transparent",
            paddingLeft: hovered === i ? 10 : 0,
            paddingRight: hovered === i ? 10 : 0,
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="shrink-0 rounded-full transition-shadow duration-150"
              style={{
                width: 9,
                height: 9,
                background: c.color,
                boxShadow: hovered === i ? `0 0 0 3px ${c.color}22` : "none",
              }}
            />
            <span className="text-[15px] font-semibold text-foreground">{c.name}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span
              className="text-sm transition-all duration-150"
              style={{
                color: hovered === i ? c.color : "#9CA3AF",
                transform: hovered === i ? "translateX(2px)" : "translateX(0)",
                display: "inline-block",
              }}
            >
              →
            </span>
          </div>
        </Link>
      ))}
      <Link
        href="/conditions"
        className="mt-4 flex items-center gap-2 text-[13.5px] font-semibold text-primary no-underline hover:opacity-75 transition-opacity"
      >
        View all 400+ conditions →
      </Link>
    </div>
  );
}

export default function Hero() {
  const router = useRouter();
  const [condition, setCondition] = useState("");
  const [zip, setZip] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedCondition = condition.trim();
    const trimmedZip = zip.trim();
    const normalizedZip = trimmedZip ? trimmedZip.slice(0, 5) : "";

    if (!trimmedCondition) {
      setError("Enter a condition to get started.");
      return;
    }

    if (normalizedZip && !/^\d{5}$/.test(normalizedZip)) {
      setError("Enter a valid 5-digit ZIP code, or leave it blank.");
      return;
    }

    setError(null);

    const conditionSlug = toConditionSlug(trimmedCondition);
    track.hero_search_submit({
      condition_slug: conditionSlug,
      zip3: normalizedZip ? normalizedZip.slice(0, 3) : undefined,
    });

    const params = new URLSearchParams({ condition: trimmedCondition });
    if (normalizedZip) params.set("zip", normalizedZip);
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
        <div className="grid gap-16 lg:grid-cols-2 lg:items-start lg:gap-[72px]">

          {/* Left column */}
          <div className="flex flex-col gap-7 lg:self-center">

            {/* Live eyebrow */}
            <div className="inline-flex items-center gap-[9px] text-[11.5px] font-semibold uppercase tracking-[0.1em] text-primary w-fit">
              <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-primary animate-pulse" />
              ClinicalTrials.gov data · refreshed daily
            </div>

            {/* H1 */}
            <h1
              id="hero-heading"
              className="font-display font-normal text-balance text-foreground leading-[1.08] tracking-[-0.022em]"
              style={{ fontSize: "clamp(36px, 4.2vw, 56px)" }}
            >
              Find clinical trials{" "}
              <em className="not-italic italic text-primary">that fit your life.</em>
            </h1>

            {/* Subhead */}
            <p className="text-[17.5px] text-muted-foreground leading-relaxed max-w-[440px]">
              Search actively enrolling studies, see which ones may fit, and bring a clear summary
              to your next care visit.
            </p>

            {/* Search form */}
            <form onSubmit={handleSubmit} className="relative w-full max-w-[540px]">
              <div className="flex flex-col items-stretch gap-1.5 rounded-2xl border border-border/35 bg-white p-[7px] shadow-[0_2px_4px_rgba(45,80,60,0.04),0_20px_56px_-16px_rgba(45,80,60,0.15)] sm:flex-row sm:items-center">
                {/* Condition input */}
                <label className="flex min-w-0 flex-1 cursor-text items-center gap-2.5 rounded-[11px] bg-[#F7F5F2] px-3.5">
                  <Search className="h-[15px] w-[15px] shrink-0 text-muted-foreground/70" aria-hidden="true" />
                  <Label htmlFor="hero-condition" className="sr-only">Condition</Label>
                  <ConditionCombobox
                    value={condition}
                    onChange={(val) => { setCondition(val); if (error) setError(null); }}
                    placeholder="Condition, e.g. Migraine"
                    className="h-[46px] border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-[14.5px] placeholder:text-muted-foreground/60 w-full justify-between"
                  />
                </label>

                {/* ZIP input */}
                <label className="flex min-w-0 cursor-text items-center gap-2 rounded-[11px] bg-[#F7F5F2] px-3 sm:w-[88px] sm:shrink-0">
                  <MapPin className="h-[13px] w-[13px] shrink-0 text-muted-foreground/70" aria-hidden="true" />
                  <Label htmlFor="hero-zip" className="sr-only">ZIP code</Label>
                  <Input
                    id="hero-zip"
                    value={zip}
                    onChange={(e) => { setZip(e.target.value.replace(/\D/g, "").slice(0, 5)); if (error) setError(null); }}
                    placeholder="ZIP"
                    className="h-[46px] w-0 flex-1 border-0 bg-transparent p-0 text-[14.5px] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength={5}
                  />
                </label>

                <Button
                  type="submit"
                  className="h-[46px] rounded-[11px] bg-primary px-5 text-[14.5px] font-semibold text-white hover:bg-primary-strong active:scale-[0.99] transition-all whitespace-nowrap sm:shrink-0"
                >
                  See matches
                </Button>
              </div>

              {error && (
                <p className="absolute top-[calc(100%+0.5rem)] left-0 px-1 text-sm font-medium text-destructive animate-in fade-in slide-in-from-top-1">
                  {error}
                </p>
              )}
            </form>

            {/* Trust micro */}
            <div className="flex max-w-full flex-wrap gap-x-[18px] gap-y-2">
              {["Free to use", "No sign-up required"].map((t) => (
                <span key={t} className="text-[12.5px] text-muted-foreground/70">{t}</span>
              ))}
            </div>
          </div>

          {/* Right column — condition list */}
          <div className="pt-1 lg:pt-2">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">
              Conditions we cover
            </p>
            <ConditionList />
          </div>
        </div>
      </div>
    </section>
  );
}

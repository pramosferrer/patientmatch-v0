"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

function StatChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-pm-border/70 bg-white/70 px-3 py-1 text-xs text-pm-muted shadow-sm">
      {children}
    </span>
  );
}

function LearnMore({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center text-sm font-medium text-pm-secondary hover:text-pm-secondaryHover"
    >
      Learn more
      <svg
        className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </svg>
    </Link>
  );
}

/** subtle branded background grid */
function SectionBg() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 opacity-[0.6]"
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(12,47,77,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(12,47,77,0.05) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
        maskImage:
          "radial-gradient(1200px 600px at 50% 0%, black, transparent 85%)",
      }}
    />
  );
}

/** minimal line-art: smooth trial-criteria curve */
function CurveArt({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-24 w-full text-pm-accent/70", className)}
      viewBox="0 0 600 120"
      fill="none"
    >
      <defs>
        <filter id="blur" x="-10" y="-10" width="620" height="140">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <path
        d="M0 80 C120 20 180 20 300 80 C420 140 480 140 600 80"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.55"
      />
      <path
        d="M0 84 C120 24 180 24 300 84 C420 144 480 144 600 84"
        stroke="currentColor"
        strokeWidth="10"
        opacity="0.09"
        filter="url(#blur)"
      />
      {/* discreet markers */}
      <g fill="currentColor" opacity="0.75">
        <circle cx="150" cy="46" r="2.2" />
        <circle cx="300" cy="84" r="2.2" />
        <circle cx="450" cy="118" r="2.2" />
      </g>
    </svg>
  );
}

/** minimal line-art: checkpoints */
function CheckpointsArt({ className }: { className?: string }) {
  return (
    <svg className={cn("h-20 w-full text-pm-accent/70", className)} viewBox="0 0 420 100" fill="none">
      <path
        d="M20 50 L140 50 M160 50 L280 50 M300 50 L400 50"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity="0.45"
      />
      {[40, 200, 360].map((x) => (
        <g key={x}>
          <circle cx={x} cy={50} r={12} stroke="currentColor" strokeWidth="1.25" opacity="0.4" />
          <path
            d={`M${x - 4} 50 l3 3 l6 -7`}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ))}
    </svg>
  );
}

/** minimal line-art: privacy shield */
function ShieldArt({ className }: { className?: string }) {
  return (
    <svg className={cn("h-20 w-full text-pm-accent/70", className)} viewBox="0 0 120 120" fill="none">
      <path
        d="M60 12c14 10 28 12 36 12v34c0 20-13 32-36 42-23-10-36-22-36-42V24c8 0 22-2 36-12Z"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.55"
      />
      <path
        d="M44 60l10 10l22-22"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ValueRelay() {
  return (
    <section className="relative py-20 md:py-24 bg-pm-brightCream">
      <SectionBg />

      <div className="container">
        {/* Intro */}
        <div className="mx-auto mb-10 max-w-2xl">
          <h2 className="font-heading text-2xl sm:text-3xl md:text-4xl font-bold text-pm-ink tracking-tightish">
            Clarity up front. Matching you can trust.
          </h2>
          <p className="mt-3 text-pm-body">
            We translate dense trial protocols into plain English, screen you against key criteria,
            and surface your likely matches—without asking for personal identifiers to start.
          </p>
        </div>

        {/* Relay grid */}
        <div className="grid gap-6 md:gap-8 lg:grid-cols-2">
          {/* 1 */}
          <div className="rounded-2xl border border-pm-border/70 bg-white/80 p-6 shadow-soft backdrop-blur-sm">
            <div className="sm:flex sm:items-start sm:justify-between">
              <div className="max-w-xl">
                <h3 className="font-heading text-xl md:text-2xl font-semibold text-pm-ink">
                  Simple screening, clear answers
                </h3>
                <p className="mt-2 text-sm md:text-base text-pm-body">
                  Answer a few clinical questions in everyday language. We pre-screen you against
                  inclusion and exclusion criteria, so you only see likely matches.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatChip>~2–3 min screening</StatChip>
                  <StatChip>No PII to start</StatChip>
                </div>
                <div className="mt-4">
                  <LearnMore href="/how-it-works" />
                </div>
              </div>
              <div className="mt-6 w-full sm:mt-0 sm:ml-8 sm:w-56">
                <CurveArt />
              </div>
            </div>
          </div>

          {/* 2 (stagger) */}
          <div className="lg:mt-8 rounded-2xl border border-pm-border/70 bg-white/80 p-6 shadow-soft backdrop-blur-sm">
            <div className="sm:flex sm:items-start sm:justify-between">
              <div className="max-w-xl">
                <h3 className="font-heading text-xl md:text-2xl font-semibold text-pm-ink">
                  Accurate matches without the jargon
                </h3>
                <p className="mt-2 text-sm md:text-base text-pm-body">
                  We map protocol criteria into structured logic and keep it up to date, so
                  exclusions are applied automatically and travel/visit needs are surfaced early.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatChip>Criteria from source protocols</StatChip>
                </div>
                <div className="mt-4">
                  <LearnMore href="/resources/about-clinical-trials" />
                </div>
              </div>
              <div className="mt-6 w-full sm:mt-0 sm:ml-8 sm:w-56">
                <CheckpointsArt />
              </div>
            </div>
          </div>

          {/* 3 */}
          <div className="rounded-2xl border border-pm-border/70 bg-white/80 p-6 shadow-soft backdrop-blur-sm lg:col-span-2">
            <div className="sm:flex sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <h3 className="font-heading text-xl md:text-2xl font-semibold text-pm-ink">
                  Private by design
                </h3>
                <p className="mt-2 text-sm md:text-base text-pm-body">
                  Start privately. PatientMatch does not collect contact information or send your
                  answers to trial sites.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatChip>Saved in your browser</StatChip>
                  <StatChip>No contact information collected</StatChip>
                </div>
                <div className="mt-4">
                  <LearnMore href="/privacy" />
                </div>
              </div>
              <div className="mt-6 w-full sm:mt-0 sm:ml-8 sm:w-56">
                <ShieldArt />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

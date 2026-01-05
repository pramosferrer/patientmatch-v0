"use client";

import { ClipboardCheck, FlaskConical, ShieldCheck, ArrowRight } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

function PillarCard({
  title,
  body,
  chips = [],
  href,
  icon: Icon,
  className,
}: {
  title: string;
  body: string;
  chips?: string[];
  href: string;
  icon: React.ComponentType<any>;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "pm-card relative isolate overflow-hidden rounded-2xl border border-pm-border/60 bg-white px-6 py-6 md:px-8 md:py-8 shadow-soft h-full",
        className
      )}
    >
      {/* faint grid background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to bottom,rgba(0,0,0,.15),rgba(0,0,0,.05))]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(2,6,23,.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(2,6,23,.035) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          backgroundPosition: "top left",
        }}
      />

      {/* icon */}
      <div className="mb-4 flex items-center justify-start">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-pm-border/60 bg-white">
          <Icon className="h-5 w-5 text-pm-accent" strokeWidth={1.75} />
        </div>
      </div>

      <h3 className="font-heading text-xl md:text-[22px] font-semibold text-pm-ink tracking-tightish">
        {title}
      </h3>

      <p className="mt-2 text-[15px] leading-relaxed text-pm-body">{body}</p>

      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((c) => (
            <span
              key={c}
              className="inline-flex items-center rounded-full border border-pm-border/70 bg-white px-3 py-[6px] text-xs text-pm-muted"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      <Link
        href={href}
        className="group mt-5 inline-flex items-center text-pm-secondary hover:text-pm-secondaryHover font-medium"
      >
        Learn more
        <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}

export default function ClarityPillars() {
  return (
    <section className="relative py-12 md:py-16 bg-pm-cream">
      <div className="container">
        <div className="mx-auto mb-8 md:mb-10 max-w-3xl">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-pm-ink tracking-tightish">
            Clarity up front. Matching you can trust.
          </h2>
          <p className="mt-2 text-pm-body">
            We translate dense trial protocols into plain English, screen you against key criteria, and surface your likely
            matches — without asking for personal identifiers to start.
          </p>
        </div>

        <div className="grid gap-5 md:gap-6 md:grid-cols-2 auto-rows-[1fr]">
          {/* Row 1, Col 1 */}
          <PillarCard
            title="Simple screening, clear answers"
            body="Answer a few clinical questions in everyday language. We pre-screen you against inclusion and exclusion criteria, so you only see likely matches."
            chips={["~2–3 min screening", "No PII to start"]}
            href="/how-it-works#screening"
            icon={ClipboardCheck}
          />

          {/* Row 1, Col 2 */}
          <PillarCard
            title="Accurate matches without the jargon"
            body="We map protocol criteria into structured logic and keep it up to date, so exclusions apply automatically and travel/visit needs are surfaced early."
            chips={["Criteria from source protocols"]}
            href="/how-it-works#matching"
            icon={FlaskConical}
          />

          {/* Row 2, full width */}
          <div className="md:col-span-2">
            <PillarCard
              title="Private by design"
              body="Start privately. Share details with a site only after you're comfortable. Our HIPAA-aware workflow uses explicit consent gating and clear next steps."
              chips={["HIPAA-aware process", "Explicit consent before sharing"]}
              href="/privacy"
              icon={ShieldCheck}
              className="md:flex md:items-center md:justify-between"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

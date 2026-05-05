"use client";

import { CheckCircle2, ListChecks, Shield, Workflow } from "lucide-react";

const steps = [
  {
    icon: <ListChecks className="h-5 w-5 text-pm-muted" />,
    title: "Answer plain-language questions",
    body: "We translate study criteria into questions patients can answer.",
  },
  {
    icon: <Workflow className="h-5 w-5 text-pm-muted" />,
    title: "We pre-screen against criteria",
    body: "Inclusion and exclusion rules are checked against your answers.",
  },
  {
    icon: <CheckCircle2 className="h-5 w-5 text-pm-muted" />,
    title: "See likely matches immediately",
    body: "See likely-fit studies and the official listings behind them.",
  },
];

export default function StepsSection() {
  return (
    <section className="relative py-16 md:py-20 bg-white">
      {/* subtle background grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(16,24,40,.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(16,24,40,.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,1), rgba(0,0,0,.85) 60%, rgba(0,0,0,0))",
        }}
      />

      <div className="container grid gap-12 md:grid-cols-[1.2fr_.9fr]">
        {/* Left: timeline */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-pm-muted mb-3">
            How it works
          </p>
          <h2 className="font-heading text-3xl md:text-[34px] tracking-tight text-pm-ink mb-6">
            Simple screening, clear answers
          </h2>
          <p className="text-pm-body max-w-prose mb-10">
            We pre-screen you against trial criteria and show likely matches without
            asking for personal identifiers.
          </p>

          <ol className="relative border-l border-pm-border pl-6 space-y-8">
            {steps.map((s, i) => (
              <li key={i} className="group">
                <div className="absolute -left-[11px] mt-1 h-5 w-5 rounded-full bg-white ring-2 ring-pm-border group-hover:ring-pm-accent transition" />
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{s.icon}</div>
                  <div>
                    <h3 className="font-medium text-pm-ink">{s.title}</h3>
                    <p className="text-pm-body text-[15px] mt-1">{s.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Right: compact "what you get" card */}
        <aside className="rounded-xl border border-pm-border bg-white/80 backdrop-blur-sm shadow-soft p-6 md:p-7">
          <h3 className="font-heading text-lg text-pm-ink mb-4">What you get</h3>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 text-pm-muted" />
              <div>
                <div className="font-medium text-pm-ink">Private by design</div>
                <p className="text-pm-body text-[15px]">
                  Start with no PII. Share details only if you choose to contact a site.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-pm-muted" />
              <div>
                <div className="font-medium text-pm-ink">Clinically grounded</div>
                <p className="text-pm-body text-[15px]">
                  Criteria come from source protocols—kept up to date.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Workflow className="mt-0.5 h-5 w-5 text-pm-muted" />
              <div>
                <div className="font-medium text-pm-ink">Clear next steps</div>
                <p className="text-pm-body text-[15px]">
                  Each match shows reasons, contact info, and what to expect.
                </p>
              </div>
            </li>
          </ul>
        </aside>
      </div>
    </section>
  );
}

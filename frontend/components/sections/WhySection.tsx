"use client";

import { FileCheck2, Filter, MapPinned, RefreshCw } from "lucide-react";

const items = [
  {
    icon: <Filter className="h-5 w-5 text-pm-muted" />,
    title: "Exclusions applied automatically",
    body: "We handle complex rules—down to medications, comorbidities, and timing.",
  },
  {
    icon: <MapPinned className="h-5 w-5 text-pm-muted" />,
    title: "Travel & visit needs surfaced",
    body: "Know distance, virtual options, and visit cadence before you reach out.",
  },
  {
    icon: <FileCheck2 className="h-5 w-5 text-pm-muted" />,
    title: "Reasons you match",
    body: "Each result shows why you likely qualify—no black box.",
  },
  {
    icon: <RefreshCw className="h-5 w-5 text-pm-muted" />,
    title: "Updates as trials change",
    body: "Protocols evolve. We refresh criteria so your results stay current.",
  },
];

export default function WhySection() {
  return (
    <section className="py-16 md:py-20 bg-pm-brightCream">
      <div className="container">
        <p className="text-xs font-medium uppercase tracking-wider text-pm-muted mb-3">
          Why PatientMatch
        </p>
        <h2 className="font-heading text-3xl md:text-[34px] tracking-tight text-pm-ink mb-6">
          Accurate matches without the jargon
        </h2>
        <p className="text-pm-body max-w-prose mb-10">
          We translate inclusion/exclusion criteria into everyday language and show
          exactly how they apply to you.
        </p>

        <div className="grid gap-5 sm:gap-6 md:grid-cols-2">
          {items.map((it, i) => (
            <div
              key={i}
              className="rounded-xl border border-pm-border bg-white shadow-soft p-5 hover:border-pm-accent/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                {it.icon}
                <div>
                  <h3 className="font-medium text-pm-ink">{it.title}</h3>
                  <p className="text-pm-body text-[15px] mt-1">{it.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

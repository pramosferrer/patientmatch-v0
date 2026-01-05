"use client";

import { Heart, FileText, Route, Shield } from "lucide-react";

const TRUST_ITEMS = [
  {
    icon: Heart,
    title: "Patient-first",
    body: "You decide what to share and can pause any time.",
  },
  {
    icon: FileText,
    title: "Clinically sourced",
    body: "Every recommendation comes from official trial records.",
  },
  {
    icon: Route,
    title: "Clear next steps",
    body: "Know what happens next, who to contact, and when to reach out.",
  },
  {
    icon: Shield,
    title: "Private by design",
    body: "We never send your info without consent. No ads. Ever.",
  },
];

export function TrustBar() {
  return (
    <section className="pm-section" data-testid="trustbar">
      <div className="pm-container">
        <div className="flex flex-col gap-6 md:grid md:grid-cols-4 md:gap-8 md:[&>*+*]:border-l md:[&>*+*]:border-slate-200 md:[&>*+*]:pl-8">
          {TRUST_ITEMS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                <h3 className="font-heading text-base font-semibold text-foreground">
                  {title}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

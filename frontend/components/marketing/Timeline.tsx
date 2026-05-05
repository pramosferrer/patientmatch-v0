"use client";

import { MotionSection } from "@/components/motion/MotionSection";

const STEPS = [
  {
    n: "01",
    title: "Quick screening",
    body: "Answer 5–8 plain-English prompts about your health, location, and preferences. Takes under two minutes.",
  },
  {
    n: "02",
    title: "Smart matching",
    body: "See studies ranked by how well they match your answers and how close they are. Understand exactly why each trial fits.",
  },
  {
    n: "03",
    title: "Prepare and decide",
    body: "Save or share your summary, then review the official listing when you are ready to ask your clinician or the study team.",
  },
];

export function Timeline() {
  return (
    <MotionSection className="py-24 bg-[#E8EDE6]">
      <div className="pm-container space-y-16">
        {/* Heading */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            How it works
          </span>
          <h2
            className="font-display font-normal text-foreground tracking-[-0.018em]"
            style={{ fontSize: "clamp(28px, 3.5vw, 44px)" }}
          >
            Three steps to your best match
          </h2>
        </div>

        {/* Steps grid */}
        <div className="grid gap-14 md:grid-cols-3 md:gap-14">
          {STEPS.map((step) => (
            <div key={step.n} className="flex flex-col gap-5">
              <div
                className="font-display font-light leading-none select-none text-primary/[0.22]"
                style={{ fontSize: 76, letterSpacing: "-0.05em" }}
                aria-hidden="true"
              >
                {step.n}
              </div>
              <div>
                <h3 className="text-[18px] font-semibold text-foreground mb-2.5">{step.title}</h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer rule */}
        <div className="border-t border-border/45 pt-7 text-center text-[13px] font-medium text-muted-foreground/70">
          Covering studies in all 50 states
        </div>
      </div>
    </MotionSection>
  );
}

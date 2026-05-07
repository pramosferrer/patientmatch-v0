"use client";

import Link from "next/link";
import { MotionSection } from "@/components/motion/MotionSection";
import { Button } from "@/components/ui/button";

const BENEFITS = [
  {
    title: "Active recruitment only",
    body: "We surface recruiting studies only — no stale or closed listings.",
  },
  {
    title: "Real logistics, clearly shown",
    body: "Drive times and remote options for every site, shown before you commit to anything.",
  },
  {
    title: "Transparent scoring",
    body: "See why every match fits your profile — not a black box, a clear explanation.",
  },
  {
    title: "Clinician-ready summaries",
    body: "Save, compare, or share a clean summary with your doctor in one click.",
  },
  {
    title: "Unbiased ranking",
    body: "No paid placement, no ads. Trials are ranked only by how well they match you.",
  },
  {
    title: "Privacy first",
    body: "We never share your information. You contact study teams directly through the official listing.",
  },
] as const;

export function Checklist() {
  return (
    <MotionSection className="py-24 bg-white">
      <div className="pm-container">
        <div className="grid gap-20 md:grid-cols-[5fr_7fr] md:items-start">

          {/* Sticky left */}
          <div className="md:sticky md:top-20 flex flex-col gap-5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              What you get
            </span>
            <h2
              className="font-display font-normal text-foreground tracking-[-0.015em] leading-[1.14]"
              style={{ fontSize: "clamp(26px, 3vw, 40px)" }}
            >
              Everything you need to decide with confidence.
            </h2>
            <p className="text-[15.5px] text-muted-foreground leading-relaxed">
              A clear view of each trial — what it involves, why it fits, and how to move
              forward safely.
            </p>
            <div className="pt-2">
              <Button asChild variant="brand" className="text-sm px-5 h-11">
                <Link href="/trials">Start matching →</Link>
              </Button>
            </div>
          </div>

          {/* Editorial list */}
          <div className="flex flex-col">
            {BENEFITS.map((item, i) => (
              <div
                key={item.title}
                className={`grid grid-cols-[20px_1fr] gap-[18px] items-start py-6 ${
                  i < BENEFITS.length - 1 ? "border-b border-border/40" : ""
                }`}
              >
                <span className="text-[13px] font-bold text-primary mt-[3px]">✓</span>
                <div>
                  <div className="text-[16px] font-semibold text-foreground mb-1.5">{item.title}</div>
                  <p className="text-[14.5px] text-muted-foreground leading-[1.62]">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MotionSection>
  );
}

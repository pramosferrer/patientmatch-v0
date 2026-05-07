"use client";

import Link from "next/link";
import { MotionSection } from "@/components/motion/MotionSection";
import { Button } from "@/components/ui/button";

type CtaBandProps = {
  eyebrow?: string | null;
  title?: string;
  description?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
};

export function CtaBand({
  title = "Ready to see what's out there?",
  description = "Start with your condition, compare studies that are enrolling now, and bring your shortlist to your next appointment.",
  primaryLabel = "Find my match",
  primaryHref = "/trials",
  secondaryLabel = "Browse all trials",
  secondaryHref = "/trials",
}: CtaBandProps) {
  return (
    <MotionSection className="relative py-24 md:py-28 overflow-hidden bg-[#E8EDE6]">
      <div className="pm-container relative">
        <div className="mx-auto flex max-w-[540px] flex-col items-center gap-5 text-center">
          <h2
            className="font-display font-normal text-foreground tracking-[-0.022em] leading-[1.1]"
            style={{ fontSize: "clamp(28px, 4vw, 48px)" }}
          >
            {title}
          </h2>
          <p className="text-[16.5px] text-muted-foreground leading-relaxed max-w-[420px]">
            {description}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Button
              asChild
              variant="brand"
              className="px-8 text-[15.5px] h-12 shadow-[0_4px_20px_rgba(45,155,112,0.28)] hover:shadow-[0_8px_32px_rgba(45,155,112,0.32)] transition-all hover:-translate-y-0.5"
            >
              <Link href={primaryHref}>{primaryLabel}</Link>
            </Button>
            {secondaryLabel && secondaryHref && (
              <Link
                href={secondaryHref}
                className="text-[15px] font-medium text-primary hover:opacity-75 transition-opacity"
              >
                {secondaryLabel} →
              </Link>
            )}
          </div>
        </div>
      </div>
    </MotionSection>
  );
}

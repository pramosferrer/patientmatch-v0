"use client";

import Link from "next/link";
import { MotionSection } from "@/components/motion/MotionSection";
import { Button } from "@/components/ui/button";
import AuroraBG from "@/components/AuroraBG";

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
  eyebrow = "Ready?",
  title = "Ready to see your matches?",
  description = "Start now—most people finish in about a minute.",
  primaryLabel = "Find my match",
  primaryHref = "/match",
  secondaryLabel = "Browse trials",
  secondaryHref = "/trials",
}: CtaBandProps) {
  return (
    <MotionSection className="pm-section relative overflow-hidden py-24 md:py-28">
      <AuroraBG className="absolute inset-0 -z-20 opacity-95" intensity="default" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-r from-white/80 via-white/50 to-white/20"
      />
      <div className="pm-container relative">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center md:gap-7">
          {eyebrow ? <span className="pm-eyebrow text-muted-foreground/80">{eyebrow}</span> : null}
          <h2 className="pm-heading-2 text-foreground">{title}</h2>
          <p className="max-w-xl text-base text-muted-foreground">{description}</p>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <Button asChild variant="brand" className="px-7 text-base">
              <Link href={primaryHref}>{primaryLabel}</Link>
            </Button>
            {secondaryLabel && secondaryHref ? (
              <Link
                href={secondaryHref}
                className="text-base font-heading font-medium text-primary transition hover:text-primary/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                {secondaryLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </MotionSection>
  );
}

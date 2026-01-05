"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { heroSamples, type HeroSample } from "@/lib/marketing/heroSamples";
import { cn } from "@/lib/utils";
import { getConditionColors } from "@/shared/colors";
import AuroraBG from "@/components/AuroraBG";

type HeroTrialPreviewProps = {
  className?: string;
};

const CONDITION_ACCENTS: Record<string, string> = {
  long_covid: "#047857",
  migraine: "#6D28D9",
  type_2_diabetes: "#0E7490",
  copd: "#0EA5E9",
  osteoarthritis: "#CA8A04",
  insomnia: "#4338CA",
  obesity: "#D97706",
  anxiety: "#2563EB",
};

function TrialCard({ item }: { item: HeroSample }) {
  const colors = getConditionColors(item.conditionSlug);
  const accentColor = CONDITION_ACCENTS[item.conditionSlug] ?? "#64748B";
  const metaParts = [item.location, ...(item.optionalChips ?? [])].filter(Boolean);

  return (
    <div className="relative flex w-full min-h-[180px] flex-col overflow-hidden rounded-none border border-hairline text-left shadow-[0_16px_40px_rgba(15,23,42,0.08)] md:min-h-[170px]">
      <AuroraBG className="absolute inset-0 z-0 opacity-85" intensity="default" />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-10 bg-gradient-to-br from-white/85 via-white/60 to-white/40"
      />
      <div className="relative z-20 flex flex-1 flex-col gap-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3 text-[12px] text-muted-foreground">
          <div className="flex flex-col gap-2">
            <span
              className="relative inline-flex items-center rounded-none border border-hairline bg-white py-1 pl-4 pr-3 font-medium text-foreground"
              style={{
                boxShadow: "0 1px 0 rgba(15,23,42,0.04)",
              }}
            >
              <span
                className="absolute left-0 top-[2px] bottom-[2px] w-1 rounded-sm"
                style={{ backgroundColor: accentColor }}
                aria-hidden="true"
              />
              {item.conditionLabel}
            </span>
            {metaParts.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1 text-[12px] text-muted-foreground">
                {metaParts.map((part, index) => (
                  <Fragment key={`${item.id}-meta-${index}`}>
                    <span>{part}</span>
                    {index < metaParts.length - 1 ? (
                      <span aria-hidden className="px-1 text-muted-foreground/50">·</span>
                    ) : null}
                  </Fragment>
                ))}
              </div>
            ) : null}
          </div>
          <Link
            href="/trials"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-primary transition hover:text-primary/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label="View example match details"
          >
            View details
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <h3 className="text-lg font-heading font-semibold leading-snug text-foreground md:text-xl">
            {item.title}
          </h3>
          <ul className="space-y-2 text-[13px] leading-relaxed text-foreground/90 md:text-sm">
            {item.bullets.map((bullet, index) => (
              <li key={`${item.id}-bullet-${index}`} className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-[1px] text-primary text-sm">
                  ✓
                </span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-muted-foreground md:text-xs">
            Matches update as you refine answers. Nothing is shared until you choose to connect.
          </p>
        </div>
      </div>
    </div>
  );
}

export function HeroTrialPreview({ className }: HeroTrialPreviewProps) {
  const dataset = useMemo(() => heroSamples, []);
  const prefersReducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isDocumentHidden, setIsDocumentHidden] = useState(false);

  useEffect(() => {
    setIndex(0);
  }, [dataset]);

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    const handleVisibility = () => setIsDocumentHidden(document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    handleVisibility();
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (
      prefersReducedMotion ||
      isHovered ||
      isDocumentHidden ||
      dataset.length <= 1
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % dataset.length);
    }, 4500);

    return () => window.clearInterval(timer);
  }, [prefersReducedMotion, isHovered, isDocumentHidden, dataset.length]);

  const activeItem =
    dataset[prefersReducedMotion ? 0 : index % dataset.length] ?? dataset[0];

  if (!activeItem) {
    return null;
  }

  if (prefersReducedMotion) {
    return (
      <div className={cn("relative", className)} aria-live="polite">
        <TrialCard item={activeItem} />
      </div>
    );
  }

  return (
    <div
      className={cn("relative will-change-transform", className)}
      aria-live="polite"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeItem.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.48, ease: [0.24, 0.9, 0.33, 1] }}
        >
          <TrialCard item={activeItem} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConditionIcon } from "@/components/icons/ConditionIcon";
import { toConditionSlug } from "@/shared/conditions-normalize";
import { cn } from "@/lib/utils";

const STATUS_COPY: Record<string, string> = {
  recruiting: "Enrolling now",
  active: "Enrolling now",
  not_yet_recruiting: "Opening soon",
  enrolling_by_invitation: "By invitation",
};

type StatusStyle = {
  label: string;
  className: string;
};

function getStatusStyle(bucket?: string | null): StatusStyle | null {
  if (!bucket) return null;
  const normalized = bucket.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === "recruiting" || normalized === "active") {
    return {
      label: STATUS_COPY[normalized] ?? "Enrolling now",
      className: "bg-urgency-soft text-urgency border-urgency/30",
    };
  }

  if (normalized === "not_yet_recruiting") {
    return {
      label: STATUS_COPY[normalized] ?? "Opening soon",
      className: "bg-caution-soft text-caution border-caution/30",
    };
  }

  if (normalized === "enrolling_by_invitation") {
    return {
      label: STATUS_COPY[normalized] ?? "By invitation",
      className: "bg-invitation-soft text-invitation border-invitation/30",
    };
  }

  if (["terminated", "withdrawn", "suspended", "completed"].includes(normalized)) {
    return {
      label: normalized.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
      className: "bg-muted/30 text-muted-foreground border-border/40",
    };
  }

  return {
    label: normalized.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
    className: "bg-muted/20 text-muted-foreground border-border/30",
  };
}

function isScreenableStatus(bucket?: string | null): boolean {
  const normalized = bucket?.trim().toLowerCase() ?? "";
  return normalized === "recruiting" || normalized === "active";
}

function resolveConditionSlug(conditions?: string[] | null): string {
  if (!Array.isArray(conditions) || conditions.length === 0) return "other";
  const first = conditions.find((item) => typeof item === "string" && item.trim().length > 0);
  if (!first) return "other";
  return toConditionSlug(first) || "other";
}

type TrialHeroProps = {
  nctId: string;
  displayTitle: string;
  officialTitle?: string | null;
  statusBucket?: string | null;
  sponsor?: string | null;
  conditions?: string[] | null;
  dataAsOfDate?: string | null;
  screenerHref?: string;
};

function formatDataAsOfDate(value?: string | null): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(monthIndex) ||
    !Number.isFinite(day) ||
    monthIndex < 0 ||
    monthIndex > 11
  ) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthIndex, day)));
}

export default function TrialHero({
  nctId,
  displayTitle,
  officialTitle,
  statusBucket,
  sponsor,
  conditions,
  dataAsOfDate,
  screenerHref = `/trial/${nctId}/screen`,
}: TrialHeroProps) {
  const [showFullTitle, setShowFullTitle] = useState(false);
  const statusStyle = useMemo(() => getStatusStyle(statusBucket), [statusBucket]);
  const isScreenable = isScreenableStatus(statusBucket);
  const conditionSlug = useMemo(() => resolveConditionSlug(conditions), [conditions]);
  const dataAsOfLabel = useMemo(() => formatDataAsOfDate(dataAsOfDate), [dataAsOfDate]);
  const hasAlternateTitle =
    typeof officialTitle === "string" &&
    officialTitle.trim().length > 0 &&
    officialTitle.trim() !== displayTitle.trim();

  return (
    <header className="space-y-5 border-b border-border/60 pb-8">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/70 text-muted-foreground">
          <ConditionIcon slug={conditionSlug} className="h-3.5 w-3.5" />
        </span>
        <span>Study details</span>
      </div>

      <div className="space-y-3">
        {statusStyle && (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
              statusStyle.className,
            )}
          >
            {statusStyle.label}
          </span>
        )}
        <h1 className="font-heading text-[32px] font-semibold leading-tight text-foreground md:text-[40px]">
          {displayTitle}
        </h1>
        {hasAlternateTitle && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowFullTitle((prev) => !prev)}
              className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-primary transition hover:text-primary/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              aria-expanded={showFullTitle}
            >
              {showFullTitle ? "Hide full title" : "See full title"}
              {showFullTitle ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              )}
            </button>
            <AnimatePresence initial={false}>
              {showFullTitle && (
                <motion.div
                  key="full-title"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <p className="text-sm text-muted-foreground">{officialTitle}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-sponsor" aria-hidden />
          <span className="text-sponsor">{sponsor || "Sponsor not listed"}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground/70">
        <span className="font-semibold text-foreground/80">NCT ID</span>
        <span className="font-mono">{nctId}</span>
        {dataAsOfLabel && (
          <>
            <span aria-hidden="true">•</span>
            <span>ClinicalTrials.gov data as of {dataAsOfLabel}</span>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {isScreenable && (
          <Button asChild variant="brand">
            <Link href={screenerHref}>Check if I qualify</Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/trials">Back to results</Link>
        </Button>
        <Link
          href={`https://clinicaltrials.gov/study/${nctId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary transition hover:text-primary/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          ClinicalTrials.gov
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}

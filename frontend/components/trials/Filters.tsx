"use client";

import { Fragment, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ConditionOption } from "./FiltersSidebar";
import { FiltersSidebarMobileButton } from "./FiltersSidebar";

// Inline helper since formatStatusBucket was never exported from PublicTrialCard
function formatStatusBucket(raw: string): { label: string } {
  const normalized = raw.toLowerCase();
  switch (normalized) {
    case "recruiting":
      return { label: "Recruiting" };
    case "not_yet_recruiting":
      return { label: "Not yet recruiting" };
    case "completed":
      return { label: "Completed" };
    case "suspended":
      return { label: "Suspended" };
    case "terminated":
      return { label: "Terminated" };
    case "withdrawn":
      return { label: "Withdrawn" };
    default:
      return { label: raw.charAt(0).toUpperCase() + raw.slice(1).replace(/_/g, " ") };
  }
}

type Mode = "browse" | "match";

type ChipDescriptor = {
  id: string;
  label: string;
  paramKey: string;
  paramValue?: string;
  removeKeys?: string[];
};

export type TrialsFiltersSummaryProps = {
  className?: string;
  conditions: ConditionOption[];
  initialFilters: Record<string, unknown>;
  mode?: Mode;
};

function toConditionLabel(conditions: ConditionOption[], slug: string): string {
  const normalized = slug.trim().toLowerCase();
  const match = conditions.find((option) => option.slug.toLowerCase() === normalized);
  if (match) return match.label;
  const spaced = slug.replace(/[_-]/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function buildConditionChips(
  params: URLSearchParams,
  options: ConditionOption[],
): ChipDescriptor[] {
  const chips: ChipDescriptor[] = [];
  const seen = new Set<string>();

  const multi = params.get("conditions");
  if (multi) {
    multi
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((slug) => {
        if (seen.has(slug)) return;
        seen.add(slug);
        chips.push({
          id: `condition:${slug}`,
          label: toConditionLabel(options, slug),
          paramKey: "conditions",
          paramValue: slug,
        });
      });
  }

  const single = params.get("condition");
  if (single && !seen.has(single)) {
    chips.push({
      id: `condition:${single}`,
      label: toConditionLabel(options, single),
      paramKey: "condition",
    });
  }

  return chips;
}

function buildSearchChip(params: URLSearchParams): ChipDescriptor[] {
  const query = (params.get("q") ?? "").trim();
  if (!query) return [];
  return [
    {
      id: `search:${query}`,
      label: `Search: ${query}`,
      paramKey: "q",
    },
  ];
}

function buildStatusChip(params: URLSearchParams): ChipDescriptor[] {
  const raw = (params.get("status_bucket") ?? params.get("status") ?? "").trim();
  if (!raw) return [];
  const normalized = raw.toLowerCase();
  return [
    {
      id: `status:${normalized}`,
      label: formatStatusBucket(normalized).label,
      paramKey: "status_bucket",
      removeKeys: ["status", "status_bucket"],
    },
  ];
}

function toChips(params: URLSearchParams, options: ConditionOption[]): ChipDescriptor[] {
  return [
    ...buildConditionChips(params, options),
    ...buildSearchChip(params),
    ...buildStatusChip(params),
  ];
}

export default function TrialsFiltersSummary({
  className,
  conditions,
  initialFilters,
  mode = "browse",
}: TrialsFiltersSummaryProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [lastAnnounced, setLastAnnounced] = useState("");

  const chips = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    return toChips(params, conditions);
  }, [conditions, searchParams]);

  const handleRemoveChip = (chip: ChipDescriptor) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");

    if (chip.removeKeys && chip.removeKeys.length > 0) {
      chip.removeKeys.forEach((key) => params.delete(key));
    } else if (chip.paramValue && chip.paramKey) {
      const raw = params.get(chip.paramKey);
      if (raw) {
        const remaining = raw
          .split(",")
          .map((value) => value.trim())
          .filter((value) => value && value !== chip.paramValue);
        if (remaining.length > 0) {
          params.set(chip.paramKey, remaining.join(","));
        } else {
          params.delete(chip.paramKey);
        }
      }
    } else if (chip.paramKey) {
      params.delete(chip.paramKey);
    }

    if (mode === "browse") {
      params.set("mode", "browse");
    } else {
      params.delete("mode");
    }

    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    setLastAnnounced(chip.label);
  };

  const handleClearAll = () => {
    const params = new URLSearchParams(searchParams.toString());
    [
      "conditions",
      "condition",
      "status_bucket",
      "status",
      "q",
      "page",
      "sort",
    ].forEach((key) => params.delete(key));

    if (mode === "browse") {
      params.set("mode", "browse");
    } else {
      params.delete("mode");
    }

    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    setLastAnnounced("Cleared all filters");
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <FiltersSidebarMobileButton initialFilters={initialFilters} conditions={conditions} />
        <div className="flex flex-wrap items-center gap-1 text-sm">
          <span className="font-medium text-muted-foreground">Filters:</span>
          {chips.length > 0 ? (
            chips.map((chip, index) => (
              <Fragment key={chip.id}>
                <button
                  type="button"
                  onClick={() => handleRemoveChip(chip)}
                  className="font-medium text-foreground underline-offset-2 transition hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:ring-offset-1"
                >
                  {chip.label}
                  <span className="sr-only"> (remove filter)</span>
                </button>
                {index < chips.length - 1 ? (
                  <span aria-hidden className="px-1 text-muted-foreground">;</span>
                ) : null}
              </Fragment>
            ))
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
          {chips.length > 0 ? (
            <>
              <span aria-hidden className="px-1 text-muted-foreground/50">·</span>
              <button
                type="button"
                onClick={handleClearAll}
                className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:ring-offset-1"
              >
                Clear all
              </button>
            </>
          ) : null}
        </div>
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {lastAnnounced}
      </span>
    </div>
  );
}

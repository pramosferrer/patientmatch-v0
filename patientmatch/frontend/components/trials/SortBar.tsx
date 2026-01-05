"use client";

import { cn } from "@/lib/utils";

export type SortOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export type SortBarProps = {
  className?: string;
  options: SortOption[];
  value: string;
  onChange: (value: string) => void;
};

export default function SortBar({ className, options, value, onChange }: SortBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-sm", className)}>
      <span className="font-medium text-muted-foreground">Sort</span>
      <div className="flex flex-wrap items-center gap-2">
        {options.map((option, index) => {
          const active = option.value === value;
          const disabled = Boolean(option.disabled);
          return (
            <div key={option.value} className="flex items-center gap-2">
              {index > 0 ? <span aria-hidden className="text-muted-foreground/50">·</span> : null}
              <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && onChange(option.value)}
                className={cn(
                  "flex items-center gap-1 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  disabled ? "cursor-not-allowed opacity-50" : undefined,
                )}
                aria-pressed={active}
              >
                {active ? <span aria-hidden className="text-primary">●</span> : null}
                <span>{option.label}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

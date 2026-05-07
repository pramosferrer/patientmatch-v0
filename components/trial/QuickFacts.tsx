import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type QuickFact = {
  icon: ReactNode;
  label: string;
};

type QuickFactsProps = {
  items: QuickFact[];
  className?: string;
};

export default function QuickFacts({ items, className }: QuickFactsProps) {
  const filtered = items.filter((item) => typeof item.label === "string" && item.label.trim().length > 0);
  if (filtered.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1 text-[12px] text-muted-foreground", className)}>
      {filtered.map((item, index) => (
        <div key={`${item.label}-${index}`} className="flex items-center gap-1">
          <span className="text-muted-foreground/70">{item.icon}</span>
          <span>{item.label}</span>
          {index < filtered.length - 1 && <span className="px-1 text-border">·</span>}
        </div>
      ))}
    </div>
  );
}

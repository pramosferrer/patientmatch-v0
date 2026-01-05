import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type SectionDividerProps = HTMLAttributes<HTMLDivElement>;

export function SectionDivider({ className, ...props }: SectionDividerProps) {
  return (
    <div
      aria-hidden="true"
      data-section-divider=""
      className={cn("pm-section-band full-bleed pointer-events-none", className)}
      {...props}
    />
  );
}

export function SectionBand(props: SectionDividerProps) {
  return <SectionDivider {...props} />;
}

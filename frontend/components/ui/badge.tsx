import * as React from "react"
import { cn } from "@/lib/utils";

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-hairline bg-white px-2 py-1 text-[12px] font-medium text-muted-foreground",
        "shadow-[0_1px_0_rgba(15,23,42,0.06)]",
        className
      )}
    >
      {children}
    </span>
  );
}

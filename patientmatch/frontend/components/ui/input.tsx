"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// NOTE: Do NOT import { Input } from "@/components/ui/input" in this file.
// That creates a self-import + name collision.

type InputVariant = "default" | "screener";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: InputVariant;
}

// Use a unique internal name to avoid accidental redeclare.
const PMInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", variant = "default", ...props }, ref) => {
    const variantClasses =
      variant === "screener"
        ? "border border-foreground/35 bg-white text-foreground shadow-[0_0_0_1px_rgba(15,23,42,0.22),0_12px_30px_rgba(15,23,42,0.12)]"
        : "border border-border bg-warm-cream/80";
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "flex h-12 min-h-[3rem] w-full rounded-none px-4 py-3 text-base text-foreground shadow-sm",
          "ring-offset-background transition duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-muted-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-primary",
          "hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-60",
          variantClasses,
          className,
        )}
        {...props}
      />
    );
  }
);
PMInput.displayName = "Input";

// Public API: named export "Input"
export { PMInput as Input };

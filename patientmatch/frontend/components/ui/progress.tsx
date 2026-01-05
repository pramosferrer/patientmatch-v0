"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

type ProgressProps = React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
  wrapperClassName?: string
  indicatorClassName?: string
  label?: string
  value?: number
  currentStep?: number
  totalSteps?: number
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(
  (
    {
      className,
      wrapperClassName,
      indicatorClassName,
      label = "Progress",
      value = 0,
      currentStep,
      totalSteps,
      ...props
    },
    ref
  ) => {
    const clampedValue = Math.min(100, Math.max(0, value ?? 0))
    const total =
      typeof totalSteps === "number" && totalSteps > 0 ? Math.round(totalSteps) : undefined
    const current =
      typeof currentStep === "number" && currentStep >= 0 ? Math.min(Math.round(currentStep), total ?? Infinity) : undefined
    const hasSteps = typeof current === "number" && typeof total === "number"

    return (
      <div className={cn("space-y-2", wrapperClassName)}>
        <div className="flex items-center justify-between text-xs font-medium tracking-wide text-muted-foreground">
          <span>{label}</span>
          {hasSteps ? (
            <span aria-live="polite" className="text-foreground">
              {current} of {total} done
            </span>
          ) : (
            <span aria-live="polite" className="text-foreground">
              {Math.round(clampedValue)}%
            </span>
          )}
        </div>
        <ProgressPrimitive.Root
          ref={ref}
          value={clampedValue}
          className={cn(
            "relative h-3 w-full overflow-hidden rounded-full bg-warm-rose/60",
            "ring-1 ring-border/40 shadow-inner",
            className
          )}
          {...props}>
          <ProgressPrimitive.Indicator
            className={cn(
              "h-full w-full flex-1 bg-[linear-gradient(90deg,var(--color-accent),var(--color-primary))]",
              "transition-[transform,opacity] duration-300 ease-out",
              indicatorClassName
            )}
            style={{ transform: `translateX(-${100 - clampedValue}%)` }} />
        </ProgressPrimitive.Root>
      </div>
    )
  }
)
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }

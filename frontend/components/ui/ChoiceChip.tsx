import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type ChoiceChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  keyHint?: string | null;
};

export const ChoiceChip = forwardRef<HTMLButtonElement, ChoiceChipProps>(
  ({ selected = false, keyHint, className, children, ...props }, ref) => {
    const baseClasses =
      "inline-flex items-center gap-2 rounded-lg border border-hairline bg-white px-4 py-3 text-base leading-snug min-h-[44px] min-w-[8.5rem] whitespace-normal break-words transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

    const selectedClasses = selected
      ? "border-primary bg-[color-mix(in_oklab,var(--color-primary) 10%,#fff 90%)] text-primary"
      : "text-foreground hover:bg-[color-mix(in_oklab,var(--color-foreground) 6%,transparent)]";

    return (
      <button
        ref={ref}
        type="button"
        className={cn(baseClasses, selectedClasses, className)}
        aria-pressed={selected}
        {...props}
      >
        {keyHint ? (
          <span
            aria-hidden="true"
            className="inline-flex min-w-[1.75rem] items-center justify-center rounded-sm border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-xs font-medium text-primary"
          >
            {keyHint}
          </span>
        ) : null}
        <span className="text-left">{children}</span>
      </button>
    );
  },
);

ChoiceChip.displayName = "ChoiceChip";

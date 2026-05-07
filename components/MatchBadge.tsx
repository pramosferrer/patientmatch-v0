import { cn } from "@/lib/utils";

export default function MatchBadge({ score }: { score?: number }) {
  const label = typeof score === "number"
    ? score >= 80 ? "Strong Match" : score >= 55 ? "Good Match" : "Possible Match"
    : "Possible Match";

  const palette = {
    "Strong Match": "border-emerald-400/60 text-emerald-700",
    "Good Match": "border-primary/40 text-primary",
    "Possible Match": "border-hairline text-muted-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] font-medium leading-tight",
        palette[label] || palette["Possible Match"]
      )}
    >
      {label}
    </span>
  );
}

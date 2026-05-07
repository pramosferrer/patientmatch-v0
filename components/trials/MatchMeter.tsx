"use client";

import { cn } from "@/lib/utils";

type MatchMeterProps = {
    score: number;
    label: string;
    message?: string;
    className?: string;
    compact?: boolean;
};

export function MatchMeter({ score, label, message, className, compact }: MatchMeterProps) {
    const getBadgeStyle = (s: number) => {
        if (s >= 90) return "bg-emerald-100 text-emerald-700 border-emerald-200";
        if (s >= 60) return "bg-amber-100 text-amber-700 border-amber-200";
        return "bg-slate-100 text-slate-500 border-slate-200";
    };

    const badgeText = (s: number, l: string) => {
        if (s >= 90) return "Global Match";
        if (s >= 60) return "Strong Candidate";
        if (s >= 40) return "Potential Match";
        // If score is very low, maybe just "Match Analysis" or hide?
        // Returning label passed in, or default based on score.
        return l || "Potential Match";
    };

    if (compact) {
        return (
            <span className={cn("inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border whitespace-nowrap", getBadgeStyle(score), className)}>
                {badgeText(score, label)}
            </span>
        );
    }

    return (
        <div className={cn("flex flex-col gap-1 w-full items-start", className)}>
            <div className={cn(
                "px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wide text-center w-full",
                getBadgeStyle(score)
            )}>
                {badgeText(score, label)}
            </div>
            {/* Optional: We could show % below if needed, but user said 'two numbers' was bad. Badge implies generic level. */}
        </div>
    );
}

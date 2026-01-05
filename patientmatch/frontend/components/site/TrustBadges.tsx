"use client";
import { cn } from "@/lib/utils";
import { ShieldCheck, EyeOff, Lock } from "lucide-react";

export default function TrustBadges({ className }: { className?: string }) {
  const pill = "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm bg-muted/50";
  const icon = "h-4 w-4";
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <span className={pill} title="Verified, up-to-date trial listings direct from ClinicalTrials.gov">
        <ShieldCheck className={icon} aria-hidden="true" />
        <span>Data from ClinicalTrials.gov</span>
        <span className="sr-only">Verified, up-to-date trial listings direct from ClinicalTrials.gov</span>
      </span>
      <span className={pill}>
        <EyeOff className={icon} aria-hidden="true" />
        <span>No PII required to screen</span>
      </span>
      <span className={pill}>
        <Lock className={icon} aria-hidden="true" />
        <span>HIPAA-aligned security</span>
      </span>
    </div>
  );
}



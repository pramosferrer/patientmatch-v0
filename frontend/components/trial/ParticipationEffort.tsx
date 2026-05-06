"use strict";

import { useMemo } from "react";
import { ClipboardCheck, Route, Syringe, Stethoscope, FileText, Pill, Activity, FlaskConical, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

type ParticipationEffortProps = {
  isRemote?: boolean;
  interventionModes?: string[] | null;
  drugRoutes?: string[] | null;
  masking?: string | null;
  allocation?: string | null;
  interventionModel?: string | null;
};

// Map route to a user-friendly label and icon
function getRouteInfo(route: string) {
  const norm = route.toLowerCase();
  if (norm.includes("oral")) return { label: "Oral", icon: Pill };
  if (norm.includes("intravenous") || norm.includes("iv") || norm.includes("infusion") || norm.includes("injection")) return { label: "Injection / IV", icon: Syringe };
  return { label: route, icon: Syringe };
}

type InterventionBadge = {
  label: string;
  icon: LucideIcon;
};

export default function ParticipationEffort({
  isRemote,
  interventionModes,
  drugRoutes,
  masking,
  allocation,
  interventionModel,
}: ParticipationEffortProps) {
  const hasData = !!(isRemote != null || interventionModes?.length || drugRoutes?.length || allocation || masking);

  if (!hasData) return null;

  // Determine what intervention badges to show
  const interventionBadges: InterventionBadge[] = [];
  if (drugRoutes && drugRoutes.length > 0) {
    drugRoutes.slice(0, 2).forEach((route) => {
      interventionBadges.push(getRouteInfo(route));
    });
  } else if (interventionModes && interventionModes.length > 0) {
    interventionModes.slice(0, 2).forEach((mode) => {
      const norm = mode.toLowerCase();
      if (norm.includes("medication") || norm.includes("drug")) {
        interventionBadges.push({ label: "Medication", icon: Pill });
      } else if (norm.includes("procedure") || norm.includes("surgery")) {
        interventionBadges.push({ label: "Procedure", icon: Stethoscope });
      } else if (norm.includes("behavioral")) {
        interventionBadges.push({ label: "Behavioral", icon: ClipboardCheck });
      } else {
        interventionBadges.push({ label: mode, icon: Stethoscope });
      }
    });
  }

  const isRandomized = allocation?.toUpperCase() === "RANDOMIZED";
  const isSingleGroup = interventionModel?.toUpperCase() === "SINGLE_GROUP" || allocation?.toUpperCase() === "NON_RANDOMIZED";
  const isBlinded = masking && !masking.toUpperCase().includes("NONE") && masking.trim() !== "";
  
  let designLabel = "";
  let designDesc = "";
  if (isSingleGroup) {
    designLabel = "All receive treatment";
    designDesc = "Everyone gets the investigational treatment.";
  } else if (isRandomized && isBlinded) {
    designLabel = "Randomized & Blinded";
    designDesc = "You may get a placebo/standard care, and you won't know which.";
  } else if (isRandomized) {
    designLabel = "Randomized (Open Label)";
    designDesc = "You are randomly assigned, but you will know your treatment.";
  } else {
    designLabel = "Standard assignment";
    designDesc = "Assignment is predetermined by the study protocol.";
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-white/90 p-6 shadow-[0_2px_4px_rgba(45,80,60,0.05),_0_16px_48px_-12px_rgba(45,80,60,0.12)]">
      <div className="space-y-2 flex items-center gap-2">
        <ClipboardCheck className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-display font-normal text-foreground">Participation Burden</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        What&apos;s physically and logistically required of participants.
      </p>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Box 1: Logistics */}
        <div className="rounded-xl border border-border/40 bg-white/60 p-4 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Route className="h-4 w-4 text-muted-foreground/70" aria-hidden="true" />
            <span>Logistics & Travel</span>
          </div>
          <div className="mt-3">
            <span className="font-medium text-foreground">
              {isRemote ? "Remote / At-home" : "In-person visits"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {isRemote ? "Some or all participation from home" : "Requires travel to a study site"}
          </p>
        </div>

        {/* Box 2: Physical Intervention */}
        <div className="rounded-xl border border-border/40 bg-white/60 p-4 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Syringe className="h-4 w-4 text-muted-foreground/70" aria-hidden="true" />
            <span>Physical Intervention</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {interventionBadges.length > 0 ? (
              interventionBadges.map((badge, idx) => {
                const Icon = badge.icon;
                return (
                  <span key={idx} className="inline-flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1 text-sm font-medium text-foreground border border-border/50">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    {badge.label}
                  </span>
                );
              })
            ) : (
              <span className="font-medium text-foreground">Standard</span>
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">How treatment is administered</p>
        </div>

        {/* Box 3: Placebo / Randomization Risk */}
        <div className="rounded-xl border border-border/40 bg-white/60 p-4 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Activity className="h-4 w-4 text-muted-foreground/70" aria-hidden="true" />
            <span>Treatment Assignment</span>
          </div>
          <div className="mt-3">
            <span className="font-medium text-foreground">{designLabel}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{designDesc}</p>
        </div>

      </div>
    </section>
  );
}

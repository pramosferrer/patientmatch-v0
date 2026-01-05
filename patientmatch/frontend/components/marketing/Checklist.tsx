"use client";

import { MotionSection } from "@/components/motion/MotionSection";
import { StaggerList } from "@/components/motion/StaggerList";
import {
  Shield,
  MapPin,
  Activity,
  Target,
  FileText,
  BadgeCheck
} from "lucide-react";

const BENEFITS = [
  {
    title: "Active recruitment only",
    description: "We surface recruiting studies only. No dead ends or stale listings.",
    icon: Activity,
  },
  {
    title: "Real logistics",
    description: "See drive times plus remote options for each site clearly.",
    icon: MapPin,
  },
  {
    title: "Transparent scoring",
    description: "Understand why every match fits before you reach out.",
    icon: Target,
  },
  {
    title: "Clinician-ready summaries",
    description: "Save, compare, or share a summary with your doctor easily.",
    icon: FileText, // Or Share2
  },
  {
    title: "Unbiased ranking",
    description: "No ads or paid placement—fit always drives the order.",
    icon: BadgeCheck,
  },
  {
    title: "Privacy first",
    description: "Nothing is shared until you choose to connect with a site.",
    icon: Shield,
  },
] as const;

export function Checklist() {
  return (
    <MotionSection className="pm-section bg-stone-50/50">
      <div className="pm-container space-y-12">
        <div className="space-y-4 text-center max-w-2xl mx-auto">
          <span className="pm-eyebrow text-rose-500 font-semibold tracking-wider uppercase text-sm">Benefits</span>
          <h2 className="pm-heading-2 text-3xl md:text-4xl font-bold text-stone-800">What you get</h2>
          <p className="text-lg text-slate-600">
            A quick snapshot of why each trial matters, plus the guardrails that keep your data private.
          </p>
        </div>

        <StaggerList
          as="ul"
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          itemClassName="h-full"
        >
          {BENEFITS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="flex flex-col gap-4 p-6 bg-white rounded-none shadow-sm border border-slate-200 border-t-4 border-t-rose-500 hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-none bg-rose-50 text-rose-600 ring-1 ring-rose-100">
                  <Icon className="w-5 h-5" strokeWidth={2} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="text-slate-600 leading-relaxed text-sm">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </StaggerList>
      </div>
    </MotionSection>
  );
}

"use client";

import { MotionSection } from "@/components/motion/MotionSection";
import { StaggerList } from "@/components/motion/StaggerList";
import { ClipboardList, Sparkles, MessageSquareHeart } from "lucide-react";

const STEPS = [
  {
    title: "Quick screening",
    description: "Answer 5–8 plain-English prompts to set your preferences.",
    icon: ClipboardList,
  },
  {
    title: "Smart matching",
    description: "See likely fits ranked by eligibility signals and distance.",
    icon: Sparkles,
  },
  {
    title: "Connect & decide",
    description: "Choose sites to contact—we prep the email and next steps.",
    icon: MessageSquareHeart, // Or use another relevant icon
  },
];

export function Timeline() {
  return (
    <MotionSection className="pm-section">
      <div className="pm-container space-y-12 md:space-y-16">
        <div className="space-y-4 text-center max-w-2xl mx-auto">
          <span className="pm-eyebrow text-rose-500 font-semibold tracking-wider uppercase text-sm">Process</span>
          <h2 className="pm-heading-2 text-3xl md:text-4xl font-bold text-stone-800">How it works</h2>
          <p className="text-lg text-slate-600">
            Three simple steps to find your best study options.
          </p>
        </div>

        <div className="relative">
          {/* Connector Line (Desktop Only) */}
          <div
            className="hidden md:block absolute top-8 left-0 w-full h-0.5 border-t-2 border-dashed border-rose-100 -z-10"
            aria-hidden="true"
          />

          <StaggerList className="grid gap-12 md:grid-cols-3 md:gap-8" itemClassName="group">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="flex flex-col items-center text-center gap-6">
                  {/* Icon Circle */}
                  <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-rose-50 text-rose-500 shadow-sm ring-4 ring-white">
                    <Icon className="w-8 h-8" strokeWidth={1.5} />
                  </div>

                  {/* Content */}
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-stone-800">
                      {step.title}
                    </h3>
                    <p className="text-base text-slate-600 leading-relaxed max-w-[280px] mx-auto">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </StaggerList>
        </div>

        <div className="text-center pt-8 border-t border-slate-100">
          <p className="text-sm font-medium text-slate-500">
            Trusted by patients across 50 states.
          </p>
        </div>
      </div>
    </MotionSection>
  );
}

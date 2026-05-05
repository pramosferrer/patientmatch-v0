"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, ListChecks, Sparkles, ClipboardCheck, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

export type ProcessStep = {
  id: string;
  title: string;
  description: string;
  chip?: string;
  icon: React.ComponentType<any>;
  cta?: {
    label: string;
    href: string;
  };
};

const steps: ProcessStep[] = [
  {
    id: "step-1",
    title: "Tell us about yourself",
    description: "Share basic health info like your condition and age. No personal identifiers required to start.",
    chip: "No PII to start",
    icon: MessageSquare,
  },
  {
    id: "step-2",
    title: "We translate criteria into simple questions",
    description: "We convert complex medical criteria into clear, plain-English questions you can answer.",
    chip: "Plain-English questions",
    icon: ListChecks,
  },
  {
    id: "step-3",
    title: "See your likely matches instantly",
    description: "Get a personalized list of trials you might qualify for, with clear explanations of why.",
    chip: "Immediate ranked matches",
    icon: Sparkles,
  },
  {
    id: "step-4",
    title: "Prepare your next step",
    description: "Save or share your summary and review the official study listing. PatientMatch does not contact sites for you.",
    chip: "Clear next steps",
    icon: ClipboardCheck,
    cta: {
      label: "Find My Match",
      href: "/trials",
    },
  },
];

export default function ProcessStepper() {
  const [activeStep, setActiveStep] = useState(0);

  // Initialize from URL hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const stepIndex = steps.findIndex(step => step.id === hash.slice(1));
      if (stepIndex !== -1) {
        setActiveStep(stepIndex);
      }
    }
  }, []);

  // Update URL hash when step changes
  useEffect(() => {
    const step = steps[activeStep];
    if (step) {
      window.location.hash = step.id;
    }
  }, [activeStep]);

  const goToStep = (index: number) => {
    setActiveStep(Math.max(0, Math.min(index, steps.length - 1)));
  };

  const nextStep = () => goToStep(activeStep + 1);
  const prevStep = () => goToStep(activeStep - 1);

  const currentStep = steps[activeStep];

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Stepper Line */}
      <div className="relative mb-8">
        {/* Base line */}
        <div className="absolute top-6 left-0 right-0 h-0.5 bg-pm-border" />
        
        {/* Progress line */}
        <motion.div
          className="absolute top-6 left-0 h-0.5 bg-gradient-to-r from-pm-primary to-pm-accent"
          initial={{ width: 0 }}
          animate={{ width: `${(activeStep / (steps.length - 1)) * 100}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />

        {/* Step nodes */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const isActive = index === activeStep;
            const isCompleted = index < activeStep;
            const stepNumber = index + 1;

            return (
              <button
                key={step.id}
                onClick={() => goToStep(index)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    goToStep(index);
                  }
                }}
                className={`
                  relative flex flex-col items-center gap-2 min-w-[60px] py-2
                  focus:outline-none focus:ring-2 focus:ring-pm-primary focus:ring-offset-2 rounded-full
                  transition-all duration-200 group
                `}
                role="tab"
                aria-selected={isActive}
                aria-controls={`step-panel-${step.id}`}
              >
                {/* Node */}
                <motion.div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                    ${isActive 
                      ? "bg-pm-primary ring-2 ring-pm-primary shadow-lg" 
                      : isCompleted 
                        ? "bg-pm-accent group-hover:bg-pm-accent/80" 
                        : "bg-white border-2 border-pm-border group-hover:border-pm-primary/60 group-hover:bg-pm-softBlue"
                    }
                    transition-all duration-200
                  `}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-2 h-2 bg-white rounded-full"
                    />
                  ) : (
                    <span className={`
                      text-sm font-semibold
                      ${isActive ? "text-white" : "text-pm-muted group-hover:text-pm-primary"}
                    `}>
                      {stepNumber}
                    </span>
                  )}
                </motion.div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Panel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="rounded-xl border border-pm-border bg-gradient-to-br from-pm-brightCream/50 to-white/80 backdrop-blur-sm shadow-soft p-8"
          role="tabpanel"
          id={`step-panel-${currentStep.id}`}
          aria-labelledby={currentStep.id}
        >
          <div className="flex items-start gap-6 mb-6">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-pm-primary/10 to-pm-accent/10 border border-pm-primary/20 shadow-sm">
              <currentStep.icon className="h-8 w-8 text-pm-primary" strokeWidth={1.75} />
            </div>
            <div className="flex-1">
              <h3 className="font-sans text-2xl font-semibold text-pm-ink mb-3">
                {currentStep.title}
              </h3>
              <p className="text-pm-body leading-relaxed mb-4">
                {currentStep.description}
              </p>
              {currentStep.chip && (
                <span className="inline-flex items-center rounded-full border border-pm-primary/30 bg-pm-primary/10 px-3 py-1 text-xs font-medium text-pm-primary">
                  {currentStep.chip}
                </span>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-pm-border/30">
            <button
              onClick={prevStep}
              disabled={activeStep === 0}
              className={`
                inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200
                ${activeStep === 0
                  ? "text-pm-muted cursor-not-allowed"
                  : "text-pm-primary hover:bg-pm-softBlue"
                }
              `}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>

            <div className="flex items-center gap-3">
              <span className="text-sm text-pm-muted">
                Step {activeStep + 1} of {steps.length}
              </span>
              
              {activeStep === steps.length - 1 ? (
                // Final step - show CTA
                <Link
                  href={currentStep.cta?.href || "/trials"}
                  className="inline-flex items-center px-6 py-2 rounded-lg bg-pm-primary text-white font-medium hover:bg-pm-primaryHover transition-colors duration-200"
                >
                  {currentStep.cta?.label || "Find My Match"}
                </Link>
              ) : (
                // Other steps - show next button
                <button
                  onClick={nextStep}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-pm-primary text-white font-medium hover:bg-pm-primaryHover transition-colors duration-200"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

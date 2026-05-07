'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, Target, Users, ArrowRight } from 'lucide-react';

const steps = [
  {
    icon: Search,
    title: "Quick Screening",
    description: "Answer a few plain-English questions about your health condition, symptoms, and preferences in just 2-3 minutes to get started."
  },
  {
    icon: Target,
    title: "Smart Matching",
    description: "Our system matches you to relevant clinical trials using up-to-date clinical criteria, your location preferences, and eligibility requirements."
  },
  {
    icon: Users,
    title: "Connect & Decide",
    description: "Review your personalized matches, learn about next steps for each trial, and connect with research sites when ready to share details."
  }
];

export default function StepsStrip() {
  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 mb-3">
            How it works
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Get matched to relevant clinical trials in three simple steps
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {steps.map((step, index) => {
            const IconComponent = step.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="relative"
              >
                {/* Step number */}
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-slate-900 text-white text-sm font-medium flex items-center justify-center z-10">
                  {index + 1}
                </div>

                {/* Card */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-soft hover:shadow-soft transition-shadow h-full">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center">
                      <IconComponent className="w-6 h-6 text-slate-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        {step.title}
                      </h3>
                      <p className="text-slate-600 text-sm leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="text-center mt-8">
          <Link
            href="/how-it-works"
            className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900 font-medium group"
          >
            Learn more about our process
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}

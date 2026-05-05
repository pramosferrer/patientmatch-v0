"use client";

import { useState } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const faqs = [
  {
    question: "How does PatientMatch work?",
    answer: "PatientMatch uses AI to analyze your health profile and match you with relevant clinical trials. We screen you against trial criteria to find studies you're most likely to qualify for."
  },
  {
    question: "Is my information private?",
    answer: "PatientMatch is designed to work without collecting contact information. Matching details stay in your browser where possible, and we do not send your information to trial sites."
  },
  {
    question: "How accurate are the matches?",
    answer: "Our matching algorithm analyzes trial criteria against your profile to provide confidence scores. 'Likely match' means you meet most requirements, while 'Possible' indicates some criteria need verification."
  },
  {
    question: "What happens after I find a trial?",
    answer: "You can complete a detailed screener, save or share the summary, and review the official ClinicalTrials.gov listing. PatientMatch does not contact sites on your behalf."
  },
  {
    question: "Are there costs to participate?",
    answer: "Most clinical trials cover the cost of treatment and may provide compensation for your time and travel. The specific details vary by trial and are explained in the official listing or by the study team."
  }
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? -1 : index);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      id="faq"
      className="py-16 bg-pm-softBlue/50"
    >
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-heading text-pm-ink text-3xl md:text-4xl tracking-tightish font-bold mb-8 text-center">Frequently asked questions</h2>
          <p className="text-pm-body text-base leading-7 max-w-2xl mx-auto">
            Everything you need to know about finding and participating in clinical trials.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, index) => {
            const id = `faq-${index}`;
            const open = openIndex === index;

            return (
              <div key={index} className="bg-white/90 backdrop-blur-sm rounded-lg shadow-pm overflow-hidden hover:bg-white transition-all duration-200">
                <button
                  id={`faq-btn-${id}`}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-pm-bg/30 transition-colors"
                  aria-expanded={open}
                  aria-controls={`faq-panel-${id}`}
                  onClick={() => toggleFAQ(index)}
                >
                  <h3 className="font-heading text-pm-ink font-semibold text-lg">{faq.question}</h3>
                  <ChevronUp className={cn("h-5 w-5 text-pm-muted flex-shrink-0", open ? "" : "rotate-180")} />
                </button>

                <div
                  id={`faq-panel-${id}`}
                  role="region"
                  aria-labelledby={`faq-btn-${id}`}
                  hidden={!open}
                  className="px-6 pb-4"
                >
                  <p className="text-pm-body text-base leading-7">{faq.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}

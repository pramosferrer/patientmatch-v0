"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function CTA() {
  return (
    <motion.section
      id="bottom-cta-band"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="py-16 bg-gradient-to-r from-pm-primary via-pm-primary to-pm-primary/95 text-white"
    >
      <div className="container mx-auto px-4 md:px-6 lg:px-8 text-center">
        <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-4">Start your match in under 2 minutes.</h2>
        <p className="text-white/90 text-lg mb-8 max-w-2xl mx-auto">
          No personal information required to start screening.
          Find clinical trials that match your health profile.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/match"
            className="inline-flex items-center justify-center rounded-none bg-white text-pm-primary px-8 py-4 text-lg font-medium hover:bg-white/90 transition-all duration-200 shadow-soft hover:shadow-soft hover:scale-105"
          >
            Find My Match
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
          <Link
            href="/trials"
            className="inline-flex items-center justify-center rounded-none border border-white/30 px-8 py-4 text-lg font-medium hover:bg-white/10 hover:border-white/50 transition-all duration-200 text-white"
          >
            Browse All Trials
          </Link>
        </div>
      </div>
    </motion.section>
  );
}

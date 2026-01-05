"use client";

import FeatureCard from '@/components/FeatureCard'
import { Sparkles, FlaskRound, ShieldCheck } from 'lucide-react'

export default function HeroHighlights() {
  return (
    <section className="py-16 md:py-20 bg-pm-softBlue">
      <div className="mx-auto max-w-7xl px-6 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <FeatureCard icon={<Sparkles className="h-5 w-5 text-pm-accent" />} title="Smart Matching in Seconds">
          We scan trial criteria in plain language and pre-screen you, so you only see trials you&apos;re likely to qualify for.
        </FeatureCard>
        <FeatureCard icon={<FlaskRound className="h-5 w-5 text-pm-accent" />} title="Trials You'll Find Here">
          From symptom-relief to cutting-edge medicines—across hospitals, clinics, and remote options.
        </FeatureCard>
        <FeatureCard icon={<ShieldCheck className="h-5 w-5 text-pm-accent" />} title="Your Privacy, Clearly Explained">
          No PII to start. Clear consent before sharing details with a site.{" "}
          <a href="/privacy" className="text-pm-secondary hover:text-pm-secondaryHover underline">
            Read our Privacy Policy
          </a>.
        </FeatureCard>
      </div>
    </section>
  );
}



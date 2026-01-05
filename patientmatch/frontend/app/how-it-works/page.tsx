import { Metadata } from 'next';
import { MotionSection } from '@/components/motion/MotionSection';
import { SectionDivider } from '@/components/marketing/SectionBand';
import { CtaBand } from '@/components/marketing/CtaBand';
import { Search, ClipboardCheck, UserCheck, Shield, Heart, Clock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'How PatientMatch Works – Find Clinical Trials in Minutes',
  description: 'See how PatientMatch helps you find and check if you qualify for clinical trials. Simple, private, and free.',
  openGraph: {
    title: 'How PatientMatch Works – Find Clinical Trials in Minutes',
    description: 'See how PatientMatch helps you find and check if you qualify for clinical trials. Simple, private, and free.',
    type: 'website',
  },
};

const steps = [
  {
    id: '01',
    icon: Search,
    title: 'Find trials for your condition',
    copy: 'Search by condition or browse our database of active clinical trials. We show you studies that are currently enrolling participants near you or available remotely.',
    highlight: 'No account needed to browse',
  },
  {
    id: '02',
    icon: ClipboardCheck,
    title: 'Check if you qualify',
    copy: 'Each study has specific requirements. We turn those complex medical criteria into simple yes/no questions. Answer a few quick questions to see if you might be eligible.',
    highlight: 'Takes about 2-3 minutes',
  },
  {
    id: '03',
    icon: UserCheck,
    title: 'Connect with the research team',
    copy: 'If you look like a good match, we help you reach out to the study team. They\'ll review your answers and contact you about next steps. You\'re always in control.',
    highlight: 'Nothing shared without your permission',
  },
];

const trustPoints = [
  {
    icon: Shield,
    title: 'Your privacy comes first',
    copy: 'We never sell your data. You decide what to share and when.',
  },
  {
    icon: Heart,
    title: 'Completely free',
    copy: 'PatientMatch is free for patients. We\'re supported by research organizations.',
  },
  {
    icon: Clock,
    title: 'Updated daily',
    copy: 'Trial information comes from official registries and is refreshed regularly.',
  },
];

const faqItems = [
  {
    q: 'Is this really free?',
    a: 'Yes. PatientMatch is completely free for patients. We don\'t charge any fees or require payment.',
  },
  {
    q: 'How do you make money?',
    a: 'Research sites and sponsors pay to list their trials and connect with interested patients. This keeps the service free for you.',
  },
  {
    q: 'Is my information safe?',
    a: 'Yes. We don\'t share your personal information with anyone until you explicitly choose to connect with a study. You can browse anonymously.',
  },
  {
    q: 'What happens after I submit my information?',
    a: 'The research team reviews your answers. If you look like a good fit, they\'ll contact you (usually within a few days) to discuss the study and answer your questions.',
  },
  {
    q: 'Can I change my mind?',
    a: 'Absolutely. You can stop at any point. Even after connecting with a study, you\'re never obligated to participate.',
  },
];

export default function HowItWorksPage() {
  return (
    <main className="relative">
      <div className="pm-container py-16 md:py-20">
        <div className="space-y-16">
          {/* Hero */}
          <MotionSection className="space-y-5 text-left md:text-center">
            <h1 className="text-[34px] font-semibold leading-tight text-foreground md:text-4xl">
              Finding a clinical trial shouldn't be complicated
            </h1>
            <p className="max-w-2xl mx-auto text-base text-muted-foreground md:text-lg">
              We make it simple to discover studies for your condition and check if you might qualify — all in a few minutes.
            </p>
          </MotionSection>

          {/* Step Cards */}
          <MotionSection className="space-y-8">
            <h2 className="text-lg font-semibold text-foreground md:text-xl">How it works</h2>
            <div className="grid gap-6 md:grid-cols-3">
              {steps.map((step) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.id}
                    className="relative rounded-none border border-border/50 bg-white p-6 shadow-sm"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-none bg-rose-50 text-rose-600">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
                        Step {step.id}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground mb-4">{step.copy}</p>
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-none">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {step.highlight}
                    </div>
                  </div>
                );
              })}
            </div>
          </MotionSection>

          {/* CTA */}
          <MotionSection className="text-center py-8">
            <Button asChild variant="brand" size="lg" className="rounded-none">
              <Link href="/trials">Find trials for your condition</Link>
            </Button>
          </MotionSection>

          {/* Trust Section */}
          <MotionSection className="space-y-6 rounded-none border border-border/50 bg-slate-50 p-8">
            <h2 className="text-xl font-semibold text-foreground md:text-2xl">Why patients trust us</h2>
            <div className="grid gap-6 md:grid-cols-3">
              {trustPoints.map((point) => {
                const Icon = point.icon;
                return (
                  <div key={point.title} className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-none bg-white text-slate-600 shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{point.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{point.copy}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </MotionSection>

          {/* FAQ */}
          <MotionSection className="space-y-6">
            <h2 className="text-xl font-semibold text-foreground md:text-2xl">Common questions</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {faqItems.map((item) => (
                <div
                  key={item.q}
                  className="rounded-none border border-border/40 bg-white p-5"
                >
                  <h3 className="text-sm font-semibold text-foreground mb-2">{item.q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </MotionSection>
        </div>
      </div>
      <SectionDivider />
      <CtaBand />
    </main>
  );
}

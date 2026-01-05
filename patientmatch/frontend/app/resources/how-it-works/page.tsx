import { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  ListChecks,
  MailCheck,
  Map,
  MessageSquare,
} from 'lucide-react';
import { MotionSection } from '@/components/motion/MotionSection';
import { SectionDivider } from '@/components/marketing/SectionBand';
import { CtaBand } from '@/components/marketing/CtaBand';

type StepDetail = {
  lead: string;
  body: string;
};

type FlowStep = {
  title: string;
  subtitle: string;
  icon: ReactNode;
  details: StepDetail[];
};

const flowSteps: FlowStep[] = [
  {
    title: 'Tell us about your health',
    subtitle: 'No personal identifiers to start',
    icon: <MessageSquare className="h-6 w-6 text-primary" aria-hidden="true" />,
    details: [
      {
        lead: 'What we’ll ask:',
        body: 'Condition, age, distance or remote preference.',
      },
      {
        lead: 'We never ask here:',
        body: 'Name, Social Security number, insurance.',
      },
    ],
  },
  {
    title: 'Answer simple questions',
    subtitle: 'Plain English, 5–8 prompts',
    icon: <ListChecks className="h-6 w-6 text-primary" aria-hidden="true" />,
    details: [
      {
        lead: 'Examples:',
        body: 'Current medications, past diagnoses, timing windows.',
      },
    ],
  },
  {
    title: 'Review options',
    subtitle: 'Ranked by eligibility signals + distance/remote',
    icon: <Map className="h-6 w-6 text-primary" aria-hidden="true" />,
    details: [
      {
        lead: 'You can:',
        body: 'Save, compare, and read “why it fits.”',
      },
    ],
  },
  {
    title: 'Connect when ready',
    subtitle: 'We prep the message',
    icon: <MailCheck className="h-6 w-6 text-primary" aria-hidden="true" />,
    details: [
      {
        lead: 'Next steps:',
        body: 'Screening call → consent → first visit.',
      },
    ],
  },
];

const privacyList = [
  'Start without personal information.',
  'You decide what to share, and when.',
  'No ads or pay-to-rank results.',
  'Study data refreshed regularly from public sources.',
];

export const metadata: Metadata = {
  title: 'How PatientMatch Works – Match with Clinical Trials in Minutes',
  description: 'See how PatientMatch turns complex trial criteria into simple questions and connects you with research sites.',
  openGraph: {
    title: 'How PatientMatch Works – Match with Clinical Trials in Minutes',
    description: 'See how PatientMatch turns complex trial criteria into simple questions and connects you with research sites.',
    type: 'website',
  },
};

export default function ResourcesHowItWorksPage() {
  return (
    <main className="relative">
      <div className="pm-container py-16 md:py-20">
        <div className="space-y-16">
          <MotionSection className="space-y-5 text-left md:text-center">
            <h1 className="text-[34px] font-semibold leading-tight text-foreground md:text-4xl">
              How PatientMatch works
            </h1>
            <p className="text-sm font-medium text-muted-foreground/80 md:text-base">
              Three quick steps. Private. No ads.
            </p>
          </MotionSection>

          <MotionSection className="space-y-10">
            <ol className="relative grid gap-10 border-l border-border/60 pl-6 md:grid-cols-4 md:gap-6 md:border-l-0 md:pl-0 md:pt-8 md:before:absolute md:before:left-0 md:before:right-0 md:before:top-12 md:before:h-px md:before:bg-border/60 md:before:content-['']">
              {flowSteps.map((step, index) => (
                <li
                  key={step.title}
                  className="relative flex flex-col gap-4 border-l border-border/60 pl-6 md:border-l-0 md:border-t md:pl-0 md:pt-8"
                >
                  <div className="flex items-start gap-3 md:flex-col md:items-start md:gap-4">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background">
                      {step.icon}
                    </span>
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold text-foreground md:text-xl">{step.title}</h2>
                      <p className="text-sm font-medium text-muted-foreground md:text-base">{step.subtitle}</p>
                    </div>
                  </div>
                  <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground md:text-base">
                    {step.details.map((detail) => (
                      <li key={`${step.title}-${detail.lead}`}>
                        <strong className="font-semibold text-foreground">{detail.lead}</strong> {detail.body}
                      </li>
                    ))}
                  </ul>
                  {index < flowSteps.length - 1 ? (
                    <span className="absolute left-[-6px] top-10 h-[calc(100%-2.5rem)] w-px bg-border/60 md:hidden" aria-hidden="true" />
                  ) : null}
                </li>
              ))}
            </ol>
          </MotionSection>

          <MotionSection className="space-y-6 rounded-2xl border border-border/50 bg-muted/40 p-8">
            <h2 className="text-xl font-semibold text-foreground md:text-2xl">Privacy &amp; control</h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {privacyList.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-transparent bg-background/70 px-4 py-3 text-sm leading-relaxed text-muted-foreground shadow-sm/5 transition hover:border-border md:text-base"
                >
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/70" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </MotionSection>
        </div>
      </div>
      <SectionDivider />
      <CtaBand />
    </main>
  );
}

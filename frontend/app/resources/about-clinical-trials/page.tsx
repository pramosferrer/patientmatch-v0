import { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  Activity,
  ClipboardCheck,
  ClipboardList,
  Compass,
  DollarSign,
  HeartHandshake,
  Map,
  Pill,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { MotionSection } from '@/components/motion/MotionSection';
import { SectionDivider } from '@/components/marketing/SectionBand';
import { CtaBand } from '@/components/marketing/CtaBand';

type PhaseNode = {
  badge: string;
  purpose: string;
  participants: string;
};

type TypeTile = {
  name: string;
  summary: string;
  examples: string[];
  icon: ReactNode;
};

type SafetyItem = {
  lead: string;
  body: string;
  icon: ReactNode;
};

type CostItem = {
  headline: string;
  body: string;
  icon: ReactNode;
};

type WhyItem = {
  headline: string;
  body: string;
  icon: ReactNode;
};

type FaqItem = {
  question: string;
  answer: string;
};

type GlossaryItem = {
  term: string;
  definition: string;
};

export const metadata: Metadata = {
  title: 'About Clinical Trials – Phases, Types, Safety, and Costs',
  description: 'Understand how clinical trials work, their phases and types, safety oversight, and typical costs/compensation.',
  openGraph: {
    title: 'About Clinical Trials – Phases, Types, Safety, and Costs',
    description: 'Understand how clinical trials work, their phases and types, safety oversight, and typical costs/compensation.',
    type: 'website',
  },
};

const tableOfContents = [
  { id: 'what-is', label: 'What is a trial' },
  { id: 'phases', label: 'Phases' },
  { id: 'types', label: 'Types' },
  { id: 'safety', label: 'Safety & oversight' },
  { id: 'costs', label: 'Costs & compensation' },
  { id: 'why', label: 'Why participate' },
  { id: 'faq', label: 'FAQs' },
  { id: 'glossary', label: 'Glossary' },
];

const phases: PhaseNode[] = [
  {
    badge: 'Phase 1',
    purpose: 'Safety & dose in first human studies',
    participants: '~20–100 people',
  },
  {
    badge: 'Phase 2',
    purpose: 'Does the treatment work for this condition?',
    participants: '~100–300 people',
  },
  {
    badge: 'Phase 3',
    purpose: 'Compare to standard care before approval',
    participants: '~1,000–3,000 people',
  },
  {
    badge: 'Phase 4',
    purpose: 'Real-world safety after approval',
    participants: 'Hundreds to thousands',
  },
];

const typeTiles: TypeTile[] = [
  {
    name: 'Interventional trials',
    summary: 'Participants receive a study treatment, procedure, or program and outcomes are measured.',
    examples: ['Drug', 'Device', 'Lifestyle'],
    icon: <Pill className="h-6 w-6 text-primary" aria-hidden="true" />,
  },
  {
    name: 'Observational studies',
    summary: 'Researchers collect health information but do not assign a treatment.',
    examples: ['Survey', 'Registry', 'Follow-up'],
    icon: <ClipboardCheck className="h-6 w-6 text-primary" aria-hidden="true" />,
  },
];

const safetyItems: SafetyItem[] = [
  {
    lead: 'Independent review —',
    body: 'IRBs approve and monitor trials.',
    icon: <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />,
  },
  {
    lead: 'Informed consent —',
    body: 'Risks, benefits, and alternatives explained clearly.',
    icon: <ClipboardList className="h-5 w-5 text-primary" aria-hidden="true" />,
  },
  {
    lead: 'Continuous monitoring —',
    body: 'Safety is reviewed throughout the study.',
    icon: <Activity className="h-5 w-5 text-primary" aria-hidden="true" />,
  },
  {
    lead: 'Right to withdraw —',
    body: 'You can stop at any time without penalty.',
    icon: <Compass className="h-5 w-5 text-primary" aria-hidden="true" />,
  },
];

const costItems: CostItem[] = [
  {
    headline: 'Study treatment cost',
    body: 'Typically $0 for participants.',
    icon: <Pill className="h-6 w-6 text-primary" aria-hidden="true" />,
  },
  {
    headline: 'Research costs',
    body: 'Often covered by the sponsor.',
    icon: <ClipboardList className="h-6 w-6 text-primary" aria-hidden="true" />,
  },
  {
    headline: 'Travel support',
    body: 'May be available for visits.',
    icon: <Map className="h-6 w-6 text-primary" aria-hidden="true" />,
  },
  {
    headline: 'Routine care',
    body: 'May be billed to insurance—ask what’s covered.',
    icon: <DollarSign className="h-6 w-6 text-primary" aria-hidden="true" />,
  },
];

const whyItems: WhyItem[] = [
  {
    headline: 'Access to new options',
    body: 'Sometimes available before wider release.',
    icon: <Sparkles className="h-7 w-7 text-primary" aria-hidden="true" />,
  },
  {
    headline: 'Experienced teams',
    body: 'Care from specialists in your condition.',
    icon: <UserRound className="h-7 w-7 text-primary" aria-hidden="true" />,
  },
  {
    headline: 'Extra monitoring',
    body: 'Structured follow-up and support.',
    icon: <Activity className="h-7 w-7 text-primary" aria-hidden="true" />,
  },
  {
    headline: 'Helps future patients',
    body: 'Contribute to research and better care.',
    icon: <HeartHandshake className="h-7 w-7 text-primary" aria-hidden="true" />,
  },
];

const faqs: FaqItem[] = [
  {
    question: 'Will I get a placebo instead of real treatment?',
    answer:
      'Some trials use a placebo to compare results. You’ll be told if a placebo is possible and what that means for your care before you decide.',
  },
  {
    question: 'Can I leave a trial if I change my mind?',
    answer:
      'Yes. Participation is voluntary. You can stop at any time without losing access to your usual medical care.',
  },
  {
    question: 'Will it cost me anything?',
    answer:
      'Study treatments are not billed to participants. Many research-related costs are covered. Ask the study team about coverage, travel support, and any compensation.',
  },
  {
    question: 'How is my safety protected?',
    answer:
      'Trials are reviewed by independent ethics boards. You’ll sign an informed consent form that explains risks and benefits, and your health is monitored throughout the study.',
  },
  {
    question: 'What happens if I qualify?',
    answer:
      'You’ll complete consent, then a screening visit or call. If eligibility is confirmed, the team will schedule your first study visit and explain the timeline.',
  },
  {
    question: 'Do trials offer remote or telehealth visits?',
    answer:
      'Many do. Some studies are fully remote; others are hybrid with occasional clinic visits. The study team will outline what to expect.',
  },
];

const glossary: GlossaryItem[] = [
  {
    term: 'Informed consent',
    definition: 'A document you review and sign that explains the study, risks, benefits, and your rights.',
  },
  {
    term: 'Placebo',
    definition: 'A treatment that looks the same as the study option but has no active ingredient.',
  },
  {
    term: 'Randomized',
    definition: 'Participants are assigned to study groups by chance rather than by choice.',
  },
  {
    term: 'Control group',
    definition: 'Participants who receive standard care or placebo for comparison.',
  },
  {
    term: 'Eligibility criteria',
    definition: 'Health factors that determine who can join the study.',
  },
];

export default function AboutClinicalTrialsPage() {
  return (
    <main className="relative">
      <div className="pm-container py-16 md:py-20">
        <div className="space-y-16">
          <MotionSection id="what-is" className="space-y-6">
            <h1 className="text-[34px] font-semibold leading-tight text-foreground md:text-4xl">
              What you should know about clinical trials
            </h1>
            <p className="text-sm font-medium text-muted-foreground md:text-base">
              A plain-English guide to help you decide confidently.
            </p>
            <div className="space-y-4 text-base text-muted-foreground md:text-lg">
              <p>
                Clinical trials are research studies that test new ways to prevent, detect, or treat disease. They help
                doctors learn whether a new approach is safe and effective.
              </p>
              <p>
                Every trial follows a detailed plan, is reviewed by independent experts, and includes steps to protect
                participants’ rights and safety.
              </p>
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold text-foreground md:text-[28px]">What is a clinical trial?</h2>
              <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                Trials answer specific questions about a treatment, device, or care approach. Some involve taking a
                study medication or using a device; others observe health over time without changing your usual care.
              </p>
            </div>
          </MotionSection>

          <MotionSection id="phases" className="space-y-8">
            <h2 className="text-2xl font-semibold text-foreground md:text-[28px]">Phases timeline</h2>
            <ol className="relative flex flex-col gap-8 border-l border-border/60 pl-6 md:flex-row md:items-start md:gap-6 md:border-l-0 md:pl-0 md:pt-6 md:before:absolute md:before:left-10 md:before:right-10 md:before:top-10 md:before:h-px md:before:bg-border/60 md:before:content-['']">
              {phases.map((phase) => (
                <li key={phase.badge} className="relative flex flex-col gap-4 md:flex-1 md:gap-5">
                  <div className="flex items-start gap-4 md:flex-col md:items-start md:gap-3">
                    <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-lg border border-border/70 bg-background">
                      <span
                        className="pointer-events-none absolute inset-[-6px] rounded-lg border border-primary/30 motion-safe:animate-[pulse_4s_ease-in-out_infinite] motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                        {phase.badge}
                      </span>
                    </span>
                    <div className="space-y-1 md:text-center md:space-y-2">
                      <p className="text-sm font-semibold text-foreground md:text-base">{phase.purpose}</p>
                      <p className="text-xs font-medium text-muted-foreground/80 md:text-sm">
                        {phase.participants}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </MotionSection>

          <MotionSection id="types" className="space-y-8">
            <h2 className="text-2xl font-semibold text-foreground md:text-[28px]">Types of studies</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {typeTiles.map((tile) => (
                <article
                  key={tile.name}
                  className="flex flex-col gap-4 rounded-lg border border-border/60 bg-background/70 p-6 shadow-sm/5"
                >
                  <div className="flex items-center gap-3">
                    {tile.icon}
                    <h3 className="text-lg font-semibold text-foreground">{tile.name}</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground md:text-base">{tile.summary}</p>
                  <div className="flex flex-wrap gap-2">
                    {tile.examples.map((example) => (
                      <span
                        key={example}
                        className="inline-flex items-center rounded-lg border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground"
                      >
                        {example}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </MotionSection>

          <MotionSection id="safety" className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground md:text-[28px]">Safety &amp; oversight</h2>
            <ul className="grid gap-4 md:grid-cols-2">
              {safetyItems.map((item) => (
                <li
                  key={item.lead}
                  className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/30 p-5 text-sm leading-relaxed text-muted-foreground md:text-base"
                >
                  {item.icon}
                  <span>
                    <strong className="font-semibold text-foreground">{item.lead}</strong> {item.body}
                  </span>
                </li>
              ))}
            </ul>
          </MotionSection>

          <MotionSection id="costs" className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground md:text-[28px]">Costs &amp; compensation</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {costItems.map((item) => (
                <article
                  key={item.headline}
                  className="flex items-start gap-4 rounded-lg border border-border/50 bg-background/70 p-5 text-sm leading-relaxed text-muted-foreground md:text-base"
                >
                  {item.icon}
                  <div>
                    <p className="text-base font-semibold text-foreground md:text-lg">{item.headline}</p>
                    <p className="text-sm text-muted-foreground md:text-base">{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </MotionSection>

          <MotionSection id="why" className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground md:text-[28px]">Why participate?</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {whyItems.map((item) => (
                <div
                  key={item.headline}
                  className="flex items-start gap-4 rounded-lg border border-border/50 bg-muted/30 p-5"
                >
                  {item.icon}
                  <div className="space-y-1 text-sm text-muted-foreground md:text-base">
                    <p className="font-semibold text-foreground">{item.headline}</p>
                    <p>{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </MotionSection>

          <MotionSection id="faq" className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground md:text-[28px]">Frequently asked questions</h2>
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border/60 bg-background/70">
              {faqs.map((faq, index) => (
                <details key={faq.question} className="group border-b border-border/60 last:border-b-0">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-foreground transition hover:text-primary md:text-base">
                    {faq.question}
                    <span className="text-lg text-muted-foreground group-open:rotate-180" aria-hidden="true">
                      ▾
                    </span>
                  </summary>
                  <div className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground md:text-base">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </MotionSection>

          <MotionSection id="glossary" className="space-y-4 border-t border-border/50 pt-8">
            <h2 className="text-2xl font-semibold text-foreground md:text-[28px]">Glossary</h2>
            <p className="text-sm text-muted-foreground md:text-base">
              Tap or hover to see quick definitions for common terms.
            </p>
            <div className="flex flex-wrap gap-3">
              {glossary.map((item) => (
                <abbr
                  key={item.term}
                  title={item.definition}
                  className="inline-flex cursor-help items-center rounded-lg border border-border/60 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground"
                >
                  {item.term}
                </abbr>
              ))}
            </div>
          </MotionSection>
        </div>
      </div>
      <SectionDivider />
      <CtaBand
        eyebrow={undefined}
        title="Ready to explore your options?"
        description="Find clinical trials that match your health condition and preferences—no personal information required to start."
        primaryLabel="Find clinical trials"
        primaryHref="/trials"
        secondaryLabel={undefined}
        secondaryHref={undefined}
      />
    </main >
  );
}

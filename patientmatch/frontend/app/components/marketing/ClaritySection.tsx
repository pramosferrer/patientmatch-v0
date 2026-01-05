'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ClipboardList, Microscope, ShieldCheck, ArrowRight } from 'lucide-react';

type FeatureCardProps = {
  title: string;
  children: React.ReactNode;
  chips?: string[];
  cta?: { href: string; label: string };
  icon?: React.ReactNode;
  className?: string;
};

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border/60 bg-warm-cream/90 px-3 py-1 text-[12px] font-medium text-muted-foreground">
      {label}
    </span>
  );
}

function FeatureCard({ title, children, chips = [], cta, icon, className }: FeatureCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={
        [
          // Clean, no-grid card
          'relative rounded-2xl border border-border bg-warm-cream/85 shadow-card',
          'p-7 md:p-8',
          className,
        ].join(' ')
      }
    >
      <div className="mb-4 flex items-center gap-3">
        {icon && (
          <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary shadow-inner">
            <div className="opacity-80">{icon}</div>
          </div>
        )}
        <h3 className="text-[20px] font-semibold leading-snug tracking-tight text-foreground">
          {title}
        </h3>
      </div>

      <div className="prose prose-sm max-w-none text-[15px] leading-7 text-muted-foreground">
        {children}
      </div>

      {(chips.length > 0 || cta) && (
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          {chips.map((c) => (
            <Chip key={c} label={c} />
          ))}

          {cta && (
            <Link
              className="group ml-auto inline-flex items-center gap-1.5 text-[15px] font-medium text-primary"
              href={cta.href}
            >
              {cta.label}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      )}
    </motion.article>
  );
}

export default function ClaritySection({
  showSectionGrid = true,
}: {
  /** set to false to remove the faint grid behind the whole section */
  showSectionGrid?: boolean;
}) {
  return (
    <section
      className="relative bg-warm-cream py-16 md:py-20"
      aria-labelledby="pm-clarity-title"
    >
      {/* Optional faint section-level grid (not inside cards) */}
      {showSectionGrid && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
        >
          <div className="h-full w-full opacity-[0.18] [background-size:24px_24px] [background-image:radial-gradient(circle_at_1px_1px,rgba(243,155,133,0.28)_1.1px,transparent_1.2px)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-transparent to-white/80" />
        </div>
      )}

      <div className="container">
        <header className="mx-auto mb-8 max-w-3xl text-center md:mb-10">
          <h2
            id="pm-clarity-title"
            className="text-[28px] font-semibold tracking-tight text-foreground md:text-[32px]"
          >
            Clarity up front. Matching you can trust.
          </h2>
          <p className="mt-3 text-[16px] leading-7 text-muted-foreground">
            We translate dense trial protocols into plain English, screen you against key criteria, and
            surface likely matches — without asking for personal identifiers to start.
          </p>
        </header>

        {/* symmetrical 2-up + 1-wide layout */}
        <div className="grid grid-cols-12 gap-6 md:gap-8">
          <FeatureCard
            className="col-span-12 md:col-span-6"
            title="Simple screening, clear answers"
            chips={['~2–3 min screening', 'No PII to start']}
            cta={{ href: '/how-it-works', label: 'Learn more' }}
            icon={<ClipboardList className="h-5 w-5 stroke-[1.75]" />}
          >
            Answer a few clinical questions in everyday language. We pre-screen you against inclusion and
            exclusion criteria so you only see likely matches.
          </FeatureCard>

          <FeatureCard
            className="col-span-12 md:col-span-6"
            title="Accurate matches without the jargon"
            chips={['Criteria from source protocols']}
            cta={{ href: '/accuracy', label: 'Learn more' }}
            icon={<Microscope className="h-5 w-5 stroke-[1.75]" />}
          >
            Protocol criteria are mapped into structured logic and kept up to date, so exclusions apply
            automatically and travel/visit needs are surfaced early.
          </FeatureCard>

          <FeatureCard
            className="col-span-12"
            title="Private by design"
            chips={['HIPAA-aware process', 'Explicit consent before sharing']}
            cta={{ href: '/privacy', label: 'Learn more' }}
            icon={<ShieldCheck className="h-5 w-5 stroke-[1.75]" />}
          >
            Start privately. Share details with a site only after you&apos;re comfortable. Our HIPAA-aware
            workflow uses explicit consent gating and clear next steps.
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}

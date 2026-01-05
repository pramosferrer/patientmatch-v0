"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { getConditionColors } from "@/shared/colors";

const conditions = [
  {
    slug: "long_covid",
    label: "Long COVID",
    description: "Post-acute sequelae of COVID-19",
    trials: "Fatigue studies, cognitive trials, respiratory research",
    interventions: "Antiviral medications, anti-inflammatory drugs, rehabilitation programs"
  },
  {
    slug: "fibromyalgia",
    label: "Fibromyalgia",
    description: "Chronic widespread pain and fatigue",
    trials: "Pain management, sleep studies, exercise programs",
    interventions: "Antidepressants, anticonvulsants, physical therapy"
  },
  {
    slug: "hidradenitis_suppurativa",
    label: "Hidradenitis Suppurativa",
    description: "Chronic inflammatory skin condition",
    trials: "Biologic therapies, surgical studies, lifestyle interventions",
    interventions: "TNF inhibitors, antibiotics, laser treatments"
  },
  {
    slug: "alzheimers",
    label: "Alzheimer's Disease",
    description: "Progressive neurodegenerative disorder",
    trials: "Memory studies, drug trials, caregiver support",
    interventions: "Cholinesterase inhibitors, immunotherapy, cognitive training"
  },
  {
    slug: "copd",
    label: "COPD",
    description: "Chronic obstructive pulmonary disease",
    trials: "Bronchodilator studies, pulmonary rehabilitation, smoking cessation",
    interventions: "Inhaled medications, oxygen therapy, exercise programs"
  },
  {
    slug: "diabetes",
    label: "Diabetes",
    description: "Metabolic disorder affecting blood sugar",
    trials: "Glucose monitoring, medication studies, lifestyle interventions",
    interventions: "Insulin therapy, oral medications, diet programs"
  }
];

// Mapping function to enrich simple condition data
const enrichCondition = (simpleCondition) => {
  const enriched = conditions.find(c => c.slug === simpleCondition.slug);
  if (enriched) {
    return enriched;
  }

  // Fallback for conditions not in our enriched list
  return {
    ...simpleCondition,
    description: "Clinical trials available for this condition",
    trials: "Various clinical trials",
    interventions: "Multiple treatment options"
  };
};

function ConditionCard({ slug, title, subtitle, common, examples, href }) {
  const colors = getConditionColors(slug);
  return (
    <div className="flex h-full flex-col rounded-none bg-white p-6 shadow-[0_16px_36px_rgba(15,23,42,0.08)] transition hover:shadow-[0_20px_48px_rgba(15,23,42,0.12)]">
      <div className="flex items-start gap-3">
        <div className={`mt-1 h-6 w-1 rounded-sm ${colors.bg}`} />
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <div className="mt-5 space-y-3 text-sm text-muted-foreground">
        <div>
          <div className="text-[12px] font-medium text-muted-foreground/80">Common trial types</div>
          <div>{common}</div>
        </div>
        <div>
          <div className="text-[12px] font-medium text-muted-foreground/80">Example interventions</div>
          <div>{examples}</div>
        </div>
      </div>

      <div className="mt-6">
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 transition hover:text-primary/80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
        >
          Find trials for {title.split(" ")[0]}
          <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}

export default function Conditions({ conditions: propConditions }) {
  // Use prop conditions if provided, otherwise use default conditions
  const displayConditions = propConditions ? propConditions.map(enrichCondition) : conditions;

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      className="bg-slate-50 py-16"
    >
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="mb-4 font-heading text-4xl font-bold text-foreground md:text-5xl">All conditions</h1>
          <p className="mx-auto max-w-3xl text-lg text-muted-foreground">
            We&apos;re currently focused on these conditions, with more coming soon.
            Each condition has different types of trials and interventions available.
          </p>
          <div className="mt-6">
            <Button asChild>
              <Link href="/conditions">View all conditions</Link>
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {displayConditions.map((condition) => (
            <ConditionCard
              key={condition.slug}
              slug={condition.slug}
              title={condition.label}
              subtitle={condition.description}
              common={condition.trials}
              examples={condition.interventions}
              href={`/match?condition=${condition.slug}`}
            />
          ))}
        </div>
      </div>
    </motion.section>
  );
}

import Link from 'next/link';
import { ConditionIcon, getConditionStyles } from '@/components/icons/ConditionIcon';

const FEATURED = [
  { slug: 'long_covid', title: 'Long COVID', blurb: 'Ongoing symptoms weeks or months after COVID-19 infection.' },
  { slug: 'fibromyalgia', title: 'Fibromyalgia', blurb: 'Chronic widespread pain, fatigue, and sleep issues.' },
  { slug: 'obesity', title: 'Obesity', blurb: 'Excess body fat affecting health, linked to other conditions.' },
];

export default function FeaturedConditions() {
  return (
    <section aria-labelledby="featured-conditions" className="py-8">
      <div className="pm-container">
        <h2 id="featured-conditions" className="font-heading tracking-tightish leading-tight text-2xl sm:text-3xl text-foreground font-semibold">
          Featured conditions
        </h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
          {FEATURED.map((c) => {
            const theme = getConditionStyles(c.slug);
            return (
              <article
                key={c.slug}
                className="group relative h-full rounded-none bg-warm-cream/85 p-5 shadow-card transition hover:-translate-y-1 hover:shadow-aurora"
              >
                <div className="flex items-start gap-4">
                  <span className={`rounded-none ${theme.bg} ${theme.text} p-2 shadow-inner`}>
                    <ConditionIcon slug={c.slug} className="h-6 w-6" />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-primary">{c.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{c.blurb}</p>
                  </div>
                </div>
                <Link href={`/match?condition=${c.slug}`} className="mt-4 inline-flex">
                  <span className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                    See trials →
                  </span>
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

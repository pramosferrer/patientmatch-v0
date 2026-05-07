"use client";
import { motion } from "framer-motion";

export function FeatureList({ items }: { items: { title: string; body: string; }[] }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="bg-warm-cream/60"
    >
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 md:grid-cols-2 md:py-20">
        {items.map((it, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-warm-cream/90 p-6 shadow-card transition hover:-translate-y-1 hover:shadow-aurora"
          >
            <h3 className="font-heading text-base font-semibold tracking-tight text-foreground">
              {it.title}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">{it.body}</p>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

"use client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function FeatureSplit({
  eyebrow, title, body, bullets, reverse = false, visual,
}: {
  eyebrow: string; title: string; body: string; bullets?: string[]; reverse?: boolean; visual?: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="bg-white"
    >
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="max-w-prose mx-auto">
          <div className="text-xs tracking-wider uppercase text-pm-muted">{eyebrow}</div>
          <h2 className="mt-2 font-heading text-3xl md:text-4xl tracking-tightish text-pm-ink">{title}</h2>
          <p className="mt-4 text-pm-body">{body}</p>
          {bullets?.length ? (
            <ul className="mt-4 space-y-2 text-pm-body">
              {bullets.map((b, i) => (
                <li key={i} className="pl-5 relative before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-sm before:bg-pm-accent/70">
                  {b}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </motion.section>
  );
}

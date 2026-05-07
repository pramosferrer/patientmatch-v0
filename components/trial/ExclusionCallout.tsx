"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, XCircle } from "lucide-react";
import { normalizePossiblyEncodedJson } from "@/lib/trials/json";

function normalizeDisqualifiers(raw: unknown): { items: string[]; hadPlaceholder: boolean } {
  const parsed = normalizePossiblyEncodedJson<unknown>(raw);
  if (!parsed) return { items: [], hadPlaceholder: false };
  const out: string[] = [];
  const seen = new Set<string>();
  let hadPlaceholder = false;

  const pushText = (value: unknown) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (key.includes("derived_from_eligibility")) {
        hadPlaceholder = true;
        return;
      }
      if (seen.has(key)) return;
      seen.add(key);
      out.push(trimmed);
    }
  };

  if (Array.isArray(parsed)) {
    parsed.forEach((item) => {
      if (typeof item === "string") return pushText(item);
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        pushText(record.text);
        pushText(record.reason);
        pushText(record.criteria);
        pushText(record.label);
      }
    });
    return { items: out, hadPlaceholder };
  }

  if (typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    const items = record.items ?? record.reasons ?? record.disqualifiers ?? record.list;
    if (Array.isArray(items)) {
      items.forEach((item) => {
        if (typeof item === "string") return pushText(item);
        if (item && typeof item === "object") {
          const entry = item as Record<string, unknown>;
          pushText(entry.text);
          pushText(entry.reason);
          pushText(entry.criteria);
          pushText(entry.label);
        }
      });
    }
  }

  return { items: out, hadPlaceholder };
}

export default function ExclusionCallout({
  raw,
}: {
  raw: unknown | null | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const { items } = useMemo(() => normalizeDisqualifiers(raw), [raw]);

  if (items.length === 0) return null;

  const visibleItems = expanded ? items : items.slice(0, 3);
  const remaining = Math.max(0, items.length - visibleItems.length);

  return (
    <section className="rounded-2xl border border-caution/30 bg-caution-soft p-6 shadow-[0_2px_4px_rgba(45,80,60,0.05),_0_16px_48px_-12px_rgba(45,80,60,0.12)]">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-caution" aria-hidden="true" />
        <h2 className="text-xl font-display font-normal text-foreground">Common exclusions</h2>
      </div>

      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        <AnimatePresence initial={false}>
          {visibleItems.map((item) => (
            <motion.li
              key={item}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-2 overflow-hidden"
            >
              <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground/60" aria-hidden="true" />
              <span>{item}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {items.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-3 text-xs font-semibold uppercase tracking-wide text-caution transition hover:text-caution/80"
        >
          {expanded ? "Show less" : `Show all ${items.length}`}
        </button>
      )}
    </section>
  );
}

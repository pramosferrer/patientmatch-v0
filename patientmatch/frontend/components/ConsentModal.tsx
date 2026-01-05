"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Shield, EyeOff, Database, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ConsentModal({ open, onAgree, onDecline, onViewPolicy }) {
  if (!open) return null;

  const items = [
    {
      icon: Shield,
      title: "HIPAA-aware care",
      copy: "We follow the same privacy standards your clinicians use.",
    },
    {
      icon: EyeOff,
      title: "No surprise sharing",
      copy: "We never send personal info to trial teams without your say-so.",
    },
    {
      icon: Database,
      title: "Secure & erasable",
      copy: "Everything stays encrypted. You can edit or delete anytime.",
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
        onClick={onDecline}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 260 }}
          className="relative w-full max-w-lg overflow-hidden rounded-none border border-border bg-warm-cream p-6 shadow-aurora md:p-8"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={onDecline}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-none bg-warm-petal/70 text-foreground shadow-card transition hover:bg-warm-petal"
            aria-label="Close privacy modal"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-4">
            <div className="h-11 w-11 shrink-0 rounded-none bg-primary/15 text-primary shadow-inner flex items-center justify-center">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-2xl font-semibold leading-snug text-foreground">
                Before we begin, here’s how we protect you
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                We only use your answers to find suitable studies. Nothing leaves this space until you approve it.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {items.map(({ icon: Icon, title, copy }) => (
              <div
                key={title}
                className="flex items-start gap-3 rounded-none bg-warm-cream/80 px-4 py-3 text-sm text-muted-foreground shadow-inner"
              >
                <span className="mt-1 text-primary">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">{title}</p>
                  <p className="mt-1 leading-relaxed">{copy}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Button
              onClick={onViewPolicy}
              variant="outline"
              className="w-full whitespace-normal break-words text-left"
            >
              Learn more
            </Button>
            <Button
              onClick={onDecline}
              variant="secondary"
              className="w-full whitespace-normal break-words text-left"
            >
              Remind me later
            </Button>
            <Button
              onClick={onAgree}
              className="flex w-full items-center justify-center gap-2 whitespace-normal break-words text-center sm:col-span-2"
            >
              <Check className="h-4 w-4" />
              I’m comfortable to continue
            </Button>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Used only to find suitable studies. You can edit or delete anytime.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

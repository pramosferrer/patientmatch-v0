'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
  MapPin,
  Share2,
} from 'lucide-react';

type FitLabel = 'Likely' | 'Possible' | 'Unlikely';

const FIT_DISPLAY_LABELS: Record<FitLabel, string> = {
  Likely: 'Likely fit',
  Possible: 'Possible fit',
  Unlikely: 'Unclear fit',
};

type ComponentDisplay = {
  key: string;
  label: string;
  percent: number | null;
  reasons: string[];
};

type ScoreBreakdownSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  sponsor?: string;
  fitLabel?: FitLabel;
  confidence?: number;
  distanceLabel?: string | null;
  cityState?: string | null;
  visitModelLabel?: string | null;
  reasons: string[];
  components: ComponentDisplay[];
  saved: boolean;
  onToggleSave: () => void;
  onCopyLink: () => void;
  onShareWithDoctor: () => void;
  copyStatus: 'idle' | 'success' | 'error';
};

export default function ScoreBreakdownSheet({
  open,
  onOpenChange,
  title,
  sponsor,
  fitLabel,
  confidence,
  distanceLabel,
  cityState,
  visitModelLabel,
  reasons,
  components,
  saved,
  onToggleSave,
  onCopyLink,
  onShareWithDoctor,
  copyStatus,
}: ScoreBreakdownSheetProps) {
  const [showDetails, setShowDetails] = useState(false);
  const firstActionRef = useRef<HTMLButtonElement | null>(null);

  const displayFitLabel = fitLabel ? FIT_DISPLAY_LABELS[fitLabel] : null;
  const headerCopy = useMemo(() => {
    if (displayFitLabel && typeof confidence === 'number') {
      return `${displayFitLabel} · ${confidence}/100`;
    }
    if (displayFitLabel) return displayFitLabel;
    if (typeof confidence === 'number') return `${confidence}/100`;
    return null;
  }, [confidence, displayFitLabel]);

  const headerTone = useMemo(() => {
    if (!fitLabel) return 'text-pm-ink';
    if (fitLabel === 'Likely') return 'text-emerald-600';
    if (fitLabel === 'Possible') return 'text-amber-600';
    return 'text-slate-600';
  }, [fitLabel]);

  const visitCopy = visitModelLabel ?? 'Ask the study team';
  const siteLabel = cityState ?? 'Study site';
  const nearestLine = distanceLabel ? `${siteLabel} — ${distanceLabel}` : 'Ask the study team';

  const handleToggleDetails = useCallback(() => {
    setShowDetails((prev) => !prev);
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full max-w-full flex-col gap-0 px-6 py-6 sm:max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          firstActionRef.current?.focus({ preventScroll: true });
        }}
      >
        <SheetHeader className="space-y-2 text-left">
          <SheetTitle className="text-lg font-semibold text-pm-ink">How we scored this match</SheetTitle>
          {headerCopy && (
            <p className={`text-sm font-medium ${headerTone}`}>{headerCopy}</p>
          )}
          <p className="text-sm font-medium text-pm-ink">{title}</p>
          {sponsor && <p className="text-xs text-pm-muted">Sponsored by {sponsor}</p>}
        </SheetHeader>

        <div className="mt-6 flex-1 overflow-y-auto space-y-6 pr-2">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-pm-ink">Why this fits</h3>
            {reasons.length > 0 ? (
              <ul className="space-y-2 text-sm text-pm-ink">
                {reasons.map((reason, index) => (
                  <li key={index} className="flex gap-2">
                    <span aria-hidden className="text-pm-primary">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-pm-muted">We’ll add details here soon.</p>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-pm-ink">What we couldn’t confirm</h3>
            <p className="text-xs text-pm-muted">Bring this up with the study team. They can confirm quickly.</p>
            <p className="text-sm text-pm-muted">Nothing flagged yet.</p>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-pm-ink">Potential exclusions to ask about</h3>
            <p className="text-sm text-pm-muted">Nothing flagged yet.</p>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-pm-ink">Nearest site</h3>
            <div className="rounded-2xl border border-pm-border/50 bg-pm-bg/70 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-pm-primary shadow-sm">
                  <MapPin className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-pm-ink">
                    {nearestLine}
                  </p>
                  <p className="mt-1 text-xs text-pm-muted">Visit options: {visitCopy}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <button
              type="button"
              onClick={handleToggleDetails}
              className="flex w-full items-center justify-between rounded-xl border border-pm-border/60 bg-white px-4 py-3 text-sm font-medium text-pm-ink shadow-sm transition hover:border-pm-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pm-primary focus-visible:ring-offset-2"
              aria-expanded={showDetails}
              aria-controls="score-breakdown-details"
            >
              <span>How the score works</span>
              {showDetails ? (
                <ChevronUp className="h-4 w-4 text-pm-muted" aria-hidden />
              ) : (
                <ChevronDown className="h-4 w-4 text-pm-muted" aria-hidden />
              )}
            </button>

            <AnimatePresence initial={false}>
              {showDetails && (
                <motion.div
                  id="score-breakdown-details"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-3 overflow-hidden"
                >
                  <p className="text-sm text-pm-muted">
                    We check your answers against the study’s criteria and logistics.
                  </p>
                  <p className="text-sm text-pm-muted">
                    The score is guidance, not a diagnosis. The study team makes the final eligibility decision.
                  </p>
                  {components.length > 0 ? (
                    components.map((component) => (
                      <div
                        key={component.key}
                        className="rounded-xl border border-pm-border/50 bg-white px-4 py-3 shadow-sm"
                      >
                        <div className="flex items-center justify-between text-sm font-medium text-pm-ink">
                          <span>{component.label}</span>
                          <span>{component.percent != null ? `${component.percent}/100` : '—'}</span>
                        </div>
                        <Progress
                          value={component.percent ?? 0}
                          className="mt-3 h-1.5 bg-pm-bg/70"
                        />
                        {component.reasons.length > 0 && (
                          <ul className="mt-3 space-y-1 text-sm text-pm-muted">
                            {component.reasons.map((reason, index) => (
                              <li key={index} className="flex gap-2">
                                <span aria-hidden>•</span>
                                <span>{reason}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-pm-muted">
                      Numeric score details aren’t available for this study yet.
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>

        <div className="border-t border-pm-border/60 pt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              ref={firstActionRef}
              variant="brand"
              onClick={onShareWithDoctor}
              className="flex-1"
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share with my doctor
            </Button>
            <Button
              variant={saved ? 'secondary' : 'outline'}
              onClick={onToggleSave}
              className="flex-1 border-pm-border/70 text-sm"
              aria-label={saved ? 'Remove trial from saved list' : 'Save trial for later'}
            >
              {saved ? (
                <>
                  <BookmarkCheck className="mr-2 h-4 w-4" />
                  Saved
                </>
              ) : (
                <>
                  <Bookmark className="mr-2 h-4 w-4" />
                  Save for later
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={onCopyLink}
              className="flex-1 border-pm-border/70 text-sm"
              aria-live="polite"
            >
              <LinkIcon className="mr-2 h-4 w-4" />
              {copyStatus === 'success'
                ? 'Link copied!'
                : copyStatus === 'error'
                ? 'Copy link (retry)'
                : 'Copy link'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

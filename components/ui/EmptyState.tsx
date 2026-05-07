'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Search, RotateCcw, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface EmptyStateProps {
  title: string;
  description?: string;
  illustration?: React.ReactNode;
  primaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export default function EmptyState({
  title,
  description,
  illustration,
  primaryAction,
  secondaryAction,
  className = ''
}: EmptyStateProps) {
  const defaultIllustration = (
    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-pm-bg border border-pm-border/30">
      <Search className="h-12 w-12 text-pm-muted" />
    </div>
  );

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      {illustration || defaultIllustration}

      <div className="mt-6 max-w-md">
        <h3 className="text-lg font-semibold text-pm-ink mb-2">{title}</h3>
        {description && (
          <p className="text-pm-body text-sm leading-relaxed">{description}</p>
        )}
      </div>

      {(primaryAction || secondaryAction) && (
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          {primaryAction && (
            <>
              {primaryAction.href ? (
                <Link href={primaryAction.href}>
                  <Button className="px-6 py-2">
                    {primaryAction.label}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Button onClick={primaryAction.onClick} className="px-6 py-2">
                  {primaryAction.label}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </>
          )}

          {secondaryAction && (
            <>
              {secondaryAction.href ? (
                <Link href={secondaryAction.href}>
                  <Button variant="outline" className="px-6 py-2">
                    {secondaryAction.label}
                  </Button>
                </Link>
              ) : (
                <Button variant="outline" onClick={secondaryAction.onClick} className="px-6 py-2">
                  {secondaryAction.label}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Specific empty state for trials - warm, encouraging messaging
export function TrialsEmptyState({ onResetFilters }: { onResetFilters?: () => void }) {
  return (
    <EmptyState
      title="No exact matches yet"
      description="We couldn't find trials matching all your criteria. Try widening your search radius or adjusting your filters to discover more opportunities."
      illustration={
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-warm-cream border border-border/40">
          <Search className="h-10 w-10 text-primary/60" />
        </div>
      }
      primaryAction={{
        label: "Expand search",
        onClick: onResetFilters
      }}
      secondaryAction={{
        label: "Browse all trials",
        href: "/trials"
      }}
    />
  );
}

// Error state for trials - reassuring, not alarming
export function TrialsErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      title="Something went wrong"
      description="We're having trouble loading trials right now. Please try again in a moment."
      illustration={
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-warm-cream border border-caution/30">
          <RotateCcw className="h-10 w-10 text-caution" />
        </div>
      }
      primaryAction={{
        label: "Try again",
        onClick: onRetry
      }}
    />
  );
}

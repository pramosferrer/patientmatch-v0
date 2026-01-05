'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorStateProps {
  title: string;
  description?: string;
  illustration?: React.ReactNode;
  retryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export default function ErrorState({
  title,
  description,
  illustration,
  retryAction,
  className = ''
}: ErrorStateProps) {
  const defaultIllustration = (
    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-red-50 border border-red-200">
      <AlertTriangle className="h-12 w-12 text-red-400" />
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

      {retryAction && (
        <div className="mt-8">
          <Button onClick={retryAction.onClick} className="px-6 py-2">
            <RotateCcw className="mr-2 h-4 w-4" />
            {retryAction.label}
          </Button>
        </div>
      )}
    </div>
  );
}

// Specific error state for trials
export function TrialsErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <ErrorState
      title="We couldn't load trials"
      description="Something went wrong while fetching the latest studies. Please try again."
      retryAction={{
        label: "Try again",
        onClick: onRetry
      }}
    />
  );
}

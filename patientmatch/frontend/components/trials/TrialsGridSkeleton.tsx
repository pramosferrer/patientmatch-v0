'use client';

import { Card, CardContent } from '@/components/ui/card';

export default function TrialCardSkeleton() {
  return (
    <Card className="flex h-full flex-col p-4 border-l-4 border-slate-200">
      {/* Top row skeleton */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-100">
          <div className="h-5 w-5 rounded-full bg-slate-200 animate-pulse" />
          <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="h-6 w-6 rounded-full bg-slate-200 animate-pulse" />
      </div>

      {/* Title skeleton */}
      <div className="mb-2">
        <div className="h-5 w-full bg-slate-200 rounded animate-pulse mb-1" />
        <div className="h-5 w-3/4 bg-slate-200 rounded animate-pulse mb-2" />
        <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
      </div>

      {/* Sponsor skeleton */}
      <div className="h-3 w-32 bg-slate-200 rounded animate-pulse mb-3" />

      {/* Facts strip skeleton */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-6 w-16 bg-slate-200 rounded-full animate-pulse" />
        ))}
      </div>

      {/* CTA row skeleton */}
      <div className="mt-auto flex items-center gap-2">
        <div className="flex-1 h-10 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-10 w-10 bg-slate-200 rounded-lg animate-pulse" />
      </div>
    </Card>
  );
}

export function TrialsGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div role="list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} role="listitem" className="h-full">
          <TrialCardSkeleton />
        </div>
      ))}
    </div>
  );
}

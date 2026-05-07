'use client';

import { cn } from '@/lib/utils';

type Props = {
  zebra?: boolean;
};

export default function RowSkeleton({ zebra }: Props) {
  return (
    <div
      className={cn(
        'border-b border-hairline px-4 py-4 sm:px-6 sm:py-5',
        zebra ? 'bg-muted/20' : 'bg-transparent',
      )}
    >
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:gap-8">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="h-4 w-20 rounded-full bg-muted/50" />
            <div className="h-4 w-12 rounded-full bg-muted/40" />
          </div>
          <div className="space-y-2">
            <div className="h-5 w-3/4 rounded bg-muted/60" />
            <div className="h-4 w-1/2 rounded bg-muted/40" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-3 w-24 rounded bg-muted/40" />
            <div className="h-3 w-28 rounded bg-muted/30" />
            <div className="h-3 w-20 rounded bg-muted/30" />
            <div className="h-3 w-16 rounded bg-muted/30" />
          </div>
          <div className="h-3 w-2/3 rounded bg-muted/30 md:w-1/2" />
        </div>
        <div className="hidden min-w-[220px] flex-col items-end gap-2 md:flex">
          <div className="h-8 w-8 rounded-full bg-muted/30" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-28 rounded-full bg-muted/40" />
            <div className="h-3 w-12 rounded bg-muted/30" />
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 md:hidden">
        <div className="h-9 w-full rounded-full bg-muted/40" />
        <div className="flex items-center justify-between gap-3">
          <div className="h-3 w-16 rounded bg-muted/30" />
          <div className="h-8 w-8 rounded-full bg-muted/30" />
        </div>
      </div>
    </div>
  );
}

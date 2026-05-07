'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TrialsEmptyState, TrialsErrorState } from '@/components/ui/EmptyState';
import { StaggerList } from '@/components/motion/StaggerList';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

import PublicTrialCard, { type PublicTrial } from '@/components/trials/PublicTrialCard';
import { ProfileCookie } from '@/shared/profileCookie';

const PAGE_SIZE = 24;

type LoadMoreProps = {
  initialTrials: PublicTrial[];
  initialPage: number;
  totalCount: number;
  searchParams: Record<string, string | string[] | undefined>;
  profile?: ProfileCookie | null;
};

function isValidTrial(trial: unknown): trial is PublicTrial {
  return Boolean(
    trial &&
    typeof (trial as PublicTrial).nct_id === 'string' &&
    typeof (trial as PublicTrial).title === 'string',
  );
}

function normalizeTrials(list: unknown[]): PublicTrial[] {
  return list.filter(isValidTrial);
}

type TrialCategory = 'recruiting' | 'upcoming' | 'other';

function categorize(trial: PublicTrial): TrialCategory {
  const status = trial.status_bucket?.toLowerCase().trim() || '';
  if (status === 'recruiting' || status === 'active') return 'recruiting';
  if (status === 'not_yet_recruiting') return 'upcoming';
  return 'other';
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="mt-5 flex items-center gap-3 border-t border-border/30 pb-3 pt-4 first:mt-4">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">
        {label}
      </span>
      <span className="flex-1 h-px bg-border/20" />
    </div>
  );
}

// ─── Pagination ─────────────────────────────────────────────────────────────

/** Build an array of page numbers + ellipsis markers for compact navigation */
function getPageRange(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | '…')[] = [1];

  if (current > 3) pages.push('…');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push('…');

  pages.push(total);
  return pages;
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages = getPageRange(currentPage, totalPages);

  const btn =
    'inline-flex items-center justify-center rounded-lg border text-[13.5px] font-medium transition-all duration-150';
  const size = 'h-9 min-w-[36px] px-2.5';

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1.5 pt-8 pb-2">
      {/* Previous */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className={cn(
          btn,
          size,
          'gap-1 px-3',
          currentPage <= 1
            ? 'pointer-events-none border-border/30 text-muted-foreground/30'
            : 'border-border/50 bg-white text-foreground hover:border-primary/30 hover:bg-primary/5 cursor-pointer',
        )}
      >
        <ChevronLeft size={14} />
        <span className="hidden sm:inline">Prev</span>
      </button>

      {/* Page numbers */}
      {pages.map((p, i) =>
        p === '…' ? (
          <span
            key={`ellipsis-${i}`}
            className="inline-flex items-center justify-center text-[13px] text-muted-foreground/50 select-none"
            style={{ minWidth: 36 }}
          >
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={cn(
              btn,
              size,
              p === currentPage
                ? 'border-primary/40 bg-primary/10 text-primary font-semibold shadow-sm'
                : 'border-border/50 bg-white text-foreground hover:border-primary/30 hover:bg-primary/5 cursor-pointer',
            )}
          >
            {p}
          </button>
        ),
      )}

      {/* Next */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className={cn(
          btn,
          size,
          'gap-1 px-3',
          currentPage >= totalPages
            ? 'pointer-events-none border-border/30 text-muted-foreground/30'
            : 'border-border/50 bg-white text-foreground hover:border-primary/30 hover:bg-primary/5 cursor-pointer',
        )}
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight size={14} />
      </button>
    </nav>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function LoadMoreTrials({
  initialTrials,
  initialPage,
  totalCount,
  searchParams,
  profile,
}: LoadMoreProps) {
  const router = useRouter();
  const urlParams = useSearchParams();
  const [trials, setTrials] = useState<PublicTrial[]>(() => normalizeTrials(initialTrials));
  const [error] = useState<string | null>(null);

  const currentPage = initialPage;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const zip = searchParams.zip as string;
  const sort = (searchParams.sort as string) || (zip ? 'distance' : 'recruiting');

  const isUnknownStatus = (status?: string | null) => {
    const n = status?.toLowerCase().trim() || '';
    return n === '' || n === 'unknown';
  };

  const getStatusPriority = (status?: string | null) => {
    const n = status?.toLowerCase().trim() || '';
    return n === 'recruiting' || n === 'active' ? 0 : 1;
  };

  const sortedTrials = useMemo(() => {
    return [...trials].sort((a, b) => {
      const unknownA = isUnknownStatus(a.status_bucket);
      const unknownB = isUnknownStatus(b.status_bucket);
      if (unknownA !== unknownB) return unknownA ? 1 : -1;

      if (sort === 'recruiting') {
        const diff = getStatusPriority(a.status_bucket) - getStatusPriority(b.status_bucket);
        if (diff !== 0) return diff;
      }

      const distA = a.distance_miles ?? a.nearest_site?.distance_miles ?? Infinity;
      const distB = b.distance_miles ?? b.nearest_site?.distance_miles ?? Infinity;
      if (distA !== distB) return distA - distB;
      return getStatusPriority(a.status_bucket) - getStatusPriority(b.status_bucket);
    });
  }, [trials, sort]);

  const groupedTrials = useMemo(() => {
    const groups: Record<TrialCategory, PublicTrial[]> = { recruiting: [], upcoming: [], other: [] };
    for (const trial of sortedTrials) groups[categorize(trial)].push(trial);
    return groups;
  }, [sortedTrials]);

  useEffect(() => {
    setTrials(normalizeTrials(initialTrials));
  }, [initialTrials, initialPage, totalCount]);

  // URL-based page navigation — keeps pages bookmarkable / shareable
  const handlePageChange = useCallback(
    (page: number) => {
      const params = new URLSearchParams(urlParams.toString());
      if (page <= 1) {
        params.delete('page');
      } else {
        params.set('page', String(page));
      }
      router.push(`/trials?${params.toString()}`);
      // Scroll to the top of the trial list
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [router, urlParams],
  );

  if (error && trials.length === 0) return <TrialsErrorState onRetry={() => router.refresh()} />;
  if (trials.length === 0 && !error) return <TrialsEmptyState onResetFilters={() => router.push('/trials')} />;

  const showRecruiting = groupedTrials.recruiting.length > 0;
  const showUpcoming = groupedTrials.upcoming.length > 0;
  const showOther = groupedTrials.other.length > 0;

  // Page range label, e.g. "1–24 of 312"
  const rangeStart = (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, totalCount);

  return (
    <section className="space-y-2">
      {/* Page info */}
      {totalCount > PAGE_SIZE && (
        <p className="text-[12.5px] tabular-nums text-muted-foreground/60">
          Showing {rangeStart}–{rangeEnd} of {totalCount.toLocaleString()} trials
        </p>
      )}

      {showRecruiting && (
        <div>
          <SectionLabel label="Enrolling now" />
          <StaggerList className="flex flex-col">
            {groupedTrials.recruiting.map((trial) => (
              <PublicTrialCard key={trial.nct_id} trial={trial} layout="row" />
            ))}
          </StaggerList>
        </div>
      )}
      {showUpcoming && (
        <div>
          <SectionLabel label="Opening soon" />
          <StaggerList className="flex flex-col">
            {groupedTrials.upcoming.map((trial) => (
              <PublicTrialCard key={trial.nct_id} trial={trial} layout="row" />
            ))}
          </StaggerList>
        </div>
      )}
      {showOther && (
        <div>
          <SectionLabel label="Other studies" />
          <StaggerList className="flex flex-col">
            {groupedTrials.other.map((trial) => (
              <PublicTrialCard key={trial.nct_id} trial={trial} layout="row" />
            ))}
          </StaggerList>
        </div>
      )}

      {/* ── Pagination controls ───────────────────────────────────────── */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </section>
  );
}

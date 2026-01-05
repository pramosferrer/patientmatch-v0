'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, Loader2 } from 'lucide-react';
import { TrialsEmptyState, TrialsErrorState } from '@/components/ui/EmptyState';

import { trialAnalytics } from '@/lib/analytics';
import PublicTrialCard, { type PublicTrial } from '@/components/trials/PublicTrialCard';
import { ProfileCookie } from '@/shared/profileCookie';

type LoadMoreProps = {
  initialTrials: PublicTrial[];
  initialPage: number;
  totalCount: number;
  searchParams: Record<string, string | string[] | undefined>;
  profile?: ProfileCookie | null;
  condition?: string;
  zip?: string;
};

const PAGE_SIZE = 24;

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

export default function LoadMoreTrials({
  initialTrials,
  initialPage,
  totalCount,
  searchParams,
  profile,
}: LoadMoreProps) {
  const [trials, setTrials] = useState<PublicTrial[]>(() => normalizeTrials(initialTrials));
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(totalCount > initialPage * PAGE_SIZE);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const condition = searchParams.condition as string;
  const zip = searchParams.zip as string;
  const sort = (searchParams.sort as string) || (zip ? 'distance' : 'recruiting');

  // Helper to check if status is unknown/empty (should always be pushed to bottom)
  const isUnknownStatus = (status?: string | null): boolean => {
    const normalized = status?.toLowerCase().trim() || '';
    return normalized === '' || normalized === 'unknown';
  };

  // Helper to get status priority: recruiting = 0, other known = 1
  const getStatusPriority = (status?: string | null): number => {
    const normalized = status?.toLowerCase().trim() || '';
    // Currently enrolling (highest priority)
    if (normalized === 'recruiting' || normalized === 'active') return 0;
    // Other known statuses
    return 1;
  };

  // Sorting Logic (Client-side)
  // ALWAYS push unknown status to bottom, then apply primary sort
  const sortedTrials = [...trials].sort((a, b) => {
    // 1. ALWAYS: Push unknown/pending status to bottom
    const unknownA = isUnknownStatus(a.status_bucket);
    const unknownB = isUnknownStatus(b.status_bucket);
    if (unknownA !== unknownB) return unknownA ? 1 : -1;

    // 2. Primary sort based on user selection
    if (sort === 'recruiting') {
      const priorityA = getStatusPriority(a.status_bucket);
      const priorityB = getStatusPriority(b.status_bucket);
      if (priorityA !== priorityB) return priorityA - priorityB;
      // Tie-breaker: distance
      const distA = a.distance_miles ?? a.nearest_site?.distance_miles ?? Infinity;
      const distB = b.distance_miles ?? b.nearest_site?.distance_miles ?? Infinity;
      return distA - distB;
    }

    // sort === 'distance' or default
    const distA = a.distance_miles ?? a.nearest_site?.distance_miles ?? Infinity;
    const distB = b.distance_miles ?? b.nearest_site?.distance_miles ?? Infinity;
    if (distA !== distB) return distA - distB;
    // Tie-breaker: recruiting first
    return getStatusPriority(a.status_bucket) - getStatusPriority(b.status_bucket);
  });

  useEffect(() => {
    setAnnouncement(`${Math.min(trials.length, totalCount)} trials shown.`);
  }, [totalCount, trials.length]);

  // Sync state with props when filters change (server-side refresh)
  useEffect(() => {
    setTrials(normalizeTrials(initialTrials));
    setCurrentPage(initialPage);
    setHasMore(totalCount > initialPage * PAGE_SIZE);
    setError(null);
  }, [initialTrials, initialPage, totalCount]);

  const loadMore = async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);

    try {
      const nextPage = currentPage + 1;
      const params = new URLSearchParams();

      Object.entries(searchParams).forEach(([key, value]) => {
        if (value == null) return;
        if (Array.isArray(value)) {
          value.forEach((entry) => params.append(key, entry));
        } else if (typeof value === 'string') {
          params.set(key, value);
        }
      });

      params.set('page', String(nextPage));

      const response = await fetch(`/api/trials?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to load trials: ${response.status}`);
      }

      const data = await response.json();
      const nextTrials = normalizeTrials(Array.isArray(data.trials) ? data.trials : []);

      if (nextTrials.length > 0) {
        setTrials((prev) => [...prev, ...nextTrials]);
        setCurrentPage(nextPage);
        if (typeof data.hasMore === 'boolean') {
          setHasMore(data.hasMore);
        } else if (typeof data.totalCount === 'number') {
          setHasMore(data.totalCount > nextPage * PAGE_SIZE);
        } else {
          setHasMore(nextTrials.length >= PAGE_SIZE);
        }
        trialAnalytics.loadMore(nextPage);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load more trials:', err);
      setError(err instanceof Error ? err.message : 'Failed to load trials');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    loadMore();
  };

  const handleResetFilters = () => {
    window.location.href = '/trials';
  };


  if (error && trials.length === 0) {
    return <TrialsErrorState onRetry={handleRetry} />;
  }

  if (trials.length === 0 && !error) {
    return <TrialsEmptyState onResetFilters={handleResetFilters} />;
  }

  return (
    <section className="pm-container space-y-5">
      {/* Condition hint when no condition is selected */}
      {(!condition || condition === 'all') && (
        <p className="text-[11px] font-medium text-[#F26A57] opacity-80 animate-pulse">
          Add a condition to narrow your results.
        </p>
      )}

      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>

      <div className="flex flex-col gap-6">
        {sortedTrials.map((trial) => (
          <PublicTrialCard key={trial.nct_id} trial={trial} />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            onClick={loadMore}
            disabled={loading}
            variant="outline"
            size="lg"
            className="w-full max-w-xs"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading…
              </>
            ) : (
              <>
                <ChevronDown className="mr-2 h-4 w-4" />
                Load more
              </>
            )}
          </Button>
        </div>
      )}
    </section>
  );
}

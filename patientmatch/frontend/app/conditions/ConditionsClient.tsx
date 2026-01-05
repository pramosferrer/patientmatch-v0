'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ConditionCatalog, ConditionItem } from '@/shared/conditions.catalog';
import { CONDITION_DETAILS } from '@/shared/conditions';
import { ConditionIcon, getConditionStyles } from '@/components/icons/ConditionIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { MapPin, Search, ArrowDown } from 'lucide-react';
import IncludeEmptyToggle from './IncludeEmptyToggle';

type SortKey = 'az' | 'trials' | 'recent';

const SORT_LABELS: Record<SortKey, string> = {
  az: 'A–Z',
  trials: 'Most trials',
  recent: 'Recently updated'
};

const DEBOUNCE_MS = 250;
const POPULAR_MAX = 6;
const PAGE_SIZE = 18;

type NearbySummary = {
  label: string;
  counts: Record<string, number>;
};

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

function matchesCondition(condition: ConditionItem, query: string) {
  if (!query) return true;
  const searchTerm = normalizeQuery(query);
  if (!searchTerm) return true;
  if (condition.label.toLowerCase().includes(searchTerm)) return true;
  if (condition.slug.toLowerCase().includes(searchTerm)) return true;
  if (condition.synonyms?.some((synonym) => synonym.toLowerCase().includes(searchTerm))) return true;
  return false;
}

function sortConditions(list: ConditionItem[], sort: SortKey) {
  const next = [...list];
  if (sort === 'trials') {
    return next.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });
  }
  if (sort === 'recent') {
    const ts = (item: ConditionItem) => (item.lastUpdated ? Date.parse(item.lastUpdated) || 0 : 0);
    return next.sort((a, b) => {
      const diff = ts(b) - ts(a);
      if (diff !== 0) return diff;
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });
  }
  return next.sort((a, b) => a.label.localeCompare(b.label));
}

function selectPopular(list: ConditionItem[]) {
  // Simple heuristic: most trials = popular
  const eligible = list
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
  return eligible.slice(0, POPULAR_MAX);
}

function getConditionDescription(condition: ConditionItem) {
  const known = CONDITION_DETAILS[condition.slug]?.description;
  if (known) return known;
  if (condition.synonyms?.length) {
    return `Often called ${condition.synonyms[0]}.`;
  }
  return `Clinical trials for ${condition.label} and related care.`;
}

function useNearbySummary(): NearbySummary | null {
  const [summary, setSummary] = useState<NearbySummary | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('patientmatch_nearby_conditions');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof parsed.label === 'string' &&
        typeof parsed.counts === 'object'
      ) {
        setSummary({
          label: parsed.label,
          counts: parsed.counts ?? {}
        });
      }
    } catch {
      // Ignore malformed data
    }
  }, []);

  return summary;
}

type ConditionsClientProps = {
  catalog: ConditionCatalog;
  initialQuery: string;
  initialIncludeEmpty: boolean;
  initialSort: SortKey;
};

export default function ConditionsClient({
  catalog,
  initialQuery,
  initialIncludeEmpty,
  initialSort
}: ConditionsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams?.toString() ?? '';
  const nearbySummary = useNearbySummary();

  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [includeEmpty, setIncludeEmpty] = useState(initialIncludeEmpty);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
  }, []);

  useEffect(() => {
    if (!mountedRef.current) return;

    const trimmed = query.trim();
    const params = new URLSearchParams();
    if (trimmed) params.set('q', trimmed);
    if (includeEmpty) params.set('includeEmpty', 'true');
    if (sort !== 'az') params.set('sort', sort);

    const nextString = params.toString();
    if (nextString === searchParamsString) return;

    router.replace(nextString ? `/conditions?${nextString}` : '/conditions', {
      scroll: false
    });
  }, [query, includeEmpty, sort, router, searchParamsString]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, includeEmpty, sort]);

  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);

  useEffect(() => {
    // Sync local state when user navigates with back/forward buttons.
    if (!mountedRef.current) return;
    const params = new URLSearchParams(searchParamsString);
    const qp = params.get('q') ?? '';
    const include = params.get('includeEmpty') === 'true';
    const sortKey = (params.get('sort') ?? 'az') as SortKey;

    setQuery((prev) => (prev === qp ? prev : qp));
    setIncludeEmpty((prev) => (prev === include ? prev : include));
    setSort((prev) => (prev === sortKey ? prev : sortKey));
  }, [searchParamsString]);

  const baseList = useMemo(() => {
    const list = includeEmpty ? catalog.all : catalog.all.filter((item) => item.count > 0);
    return list;
  }, [catalog.all, includeEmpty]);

  const filtered = useMemo(
    () => baseList.filter((item) => matchesCondition(item, debouncedQuery)),
    [baseList, debouncedQuery]
  );

  const sorted = useMemo(() => sortConditions(filtered, sort), [filtered, sort]);
  const showGrouping = debouncedQuery.trim().length === 0 && sort === 'az';

  const popular = useMemo(() => {
    if (!showGrouping) return [];
    return selectPopular(filtered);
  }, [filtered, showGrouping]);

  const popularSlugs = useMemo(() => new Set(popular.map((item) => item.slug)), [popular]);

  const allConditions = useMemo(() => {
    if (!showGrouping) return sorted;
    return sorted.filter((item) => !popularSlugs.has(item.slug));
  }, [popularSlugs, showGrouping, sorted]);

  const visibleConditions = useMemo(() => {
    return allConditions.slice(0, visibleCount);
  }, [allConditions, visibleCount]);

  const totalFiltered = filtered.length;
  const totalAll = catalog.all.length;
  const hasMore = visibleCount < allConditions.length;

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setQuery((current) => current.trim());
    },
    []
  );

  const handleSortChange = useCallback((value: string) => {
    setSort((value as SortKey) ?? 'az');
  }, []);

  const handleClearQuery = useCallback(() => {
    setQuery('');
  }, []);

  const handleLoadMore = useCallback(() => {
    setVisibleCount(prev => prev + PAGE_SIZE);
  }, []);

  const renderNearby = useCallback(
    (condition: ConditionItem) => {
      if (!nearbySummary) return null;
      const nearbyCount = nearbySummary.counts[condition.slug];
      if (typeof nearbyCount !== 'number' || nearbyCount <= 0) return null;
      const locationLabel = nearbySummary.label;
      if (!locationLabel) return null;
      return (
        <span>
          +{nearbyCount} near {locationLabel}
        </span>
      );
    },
    [nearbySummary]
  );

  const renderCondition = useCallback(
    (condition: ConditionItem) => {
      const styles = getConditionStyles(condition.slug);
      const nearbyContent = renderNearby(condition);
      const description = getConditionDescription(condition);
      const recruitingCount = condition.count;

      return (
        <li
          key={condition.slug}
          className={`group relative flex h-full flex-col overflow-hidden rounded-none border border-slate-200 border-t-4 ${styles.border} bg-slate-50/50 p-5 transition-all hover:bg-white hover:shadow-md hover:border-slate-300`}
        >
          <div className="relative flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-none bg-white border border-slate-200 ${styles.text}`}
                aria-hidden
              >
                <ConditionIcon slug={condition.slug} className="h-5 w-5" />
              </span>

              <div className="text-right">
                <p className="text-xl font-bold font-mono tabular-nums text-slate-900 leading-none tracking-tight">
                  {recruitingCount}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                  Trials
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold leading-tight text-slate-900 group-hover:text-rose-600 transition-colors">
                {condition.label}
              </h3>
              <p className="text-xs leading-relaxed text-slate-500 line-clamp-2">
                {description}
              </p>
            </div>

            {nearbyContent && (
              <div className="inline-flex items-center gap-1.5 rounded-none border border-emerald-200 bg-emerald-50/50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 w-fit font-mono uppercase tracking-wide">
                <MapPin className="h-3 w-3" />
                {nearbyContent}
              </div>
            )}
          </div>

          <div className="relative mt-auto flex items-center justify-end pt-4">
            <Link
              href={`/conditions/${condition.slug}`}
              className="absolute inset-0 z-10"
              aria-label={`View trials for ${condition.label}`}
            />
            <span className="text-xs font-bold text-slate-400 group-hover:text-rose-600 transition-colors flex items-center gap-1">
              View Hub
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </span>
          </div>
        </li>
      );
    },
    [renderNearby]
  );

  const emptyState =
    debouncedQuery.trim().length > 0 ? (
      <div className="px-3 py-12 text-center md:px-0">
        <p className="text-sm text-muted-foreground">
          No conditions found. Try a broader term.
        </p>
      </div>
    ) : null;

  return (
    <div className="space-y-10">
      <header className="relative space-y-8 py-8 md:py-10">
        <div className="space-y-4 max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Condition Hubs
          </h1>
          <p className="text-base text-slate-600 leading-relaxed max-w-xl">
            Browse our clinical trial directories by condition. Find real-time counts, nearby studies, and detailed eligibility criteria.
          </p>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <form
            onSubmit={handleSubmit}
            className="group relative flex-1 max-w-lg"
          >
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400 group-focus-within:text-rose-500 transition-colors" />
            </div>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search conditions..."
              className="h-11 pl-10 pr-10 rounded-none border-slate-300 bg-white text-sm shadow-sm focus-visible:ring-0 focus-visible:border-rose-500 transition-all font-medium placeholder:font-normal"
            />
            {query && (
              <button
                type="button"
                onClick={handleClearQuery}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors"
              >
                Clear
              </button>
            )}
          </form>

          <div className="flex flex-wrap items-center gap-4">
            <IncludeEmptyToggle checked={includeEmpty} onCheckedChange={setIncludeEmpty} />

            <div className="h-6 w-px bg-slate-200 hidden sm:block" />

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Sort</span>
              <Select value={sort} onValueChange={handleSortChange}>
                <SelectTrigger className="h-9 w-[140px] rounded-none border-slate-300 bg-white text-xs font-medium focus:ring-0">
                  <SelectValue aria-label={SORT_LABELS[sort]} placeholder="Sort" />
                </SelectTrigger>
                <SelectContent align="end" className="rounded-none border-slate-200">
                  {Object.entries(SORT_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value} className="text-xs">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400 uppercase tracking-wide">
          <p>
            Showing {Math.min(visibleCount, totalFiltered)} of {totalFiltered} conditions
            {!includeEmpty && totalAll > catalog.filtered.length && (
              <span className="ml-2 px-1.5 py-0.5 rounded-none bg-slate-100 text-[10px] normal-case tracking-normal text-slate-500 border border-slate-200">
                {totalAll - catalog.filtered.length} hidden
              </span>
            )}
          </p>
        </div>
      </header>

      {totalFiltered === 0 ? (
        emptyState
      ) : (
        <div className="space-y-12">
          {showGrouping && popular.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-none bg-rose-500" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Trending Conditions
                </h2>
              </div>

              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {popular.map((condition) => renderCondition(condition))}
              </ul>
            </section>
          )}

          <section className="space-y-4">
            {showGrouping && (
              <div className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-none bg-slate-300" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Directory ({allConditions.length})
                </h2>
              </div>
            )}
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleConditions.map((condition) => renderCondition(condition))}
            </ul>

            {hasMore && (
              <div className="pt-8 flex justify-center">
                <Button
                  onClick={handleLoadMore}
                  variant="outline"
                  size="lg"
                  className="min-w-[200px] rounded-none border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-none border"
                >
                  Load more conditions
                  <ArrowDown className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

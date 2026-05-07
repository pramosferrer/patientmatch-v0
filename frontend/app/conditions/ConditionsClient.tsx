'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ConditionCatalog, ConditionItem } from '@/shared/conditions.catalog';
import { CONDITION_DETAILS } from '@/shared/conditions';
import { getConditionHex } from '@/components/icons/ConditionIcon';
import { Search } from 'lucide-react';

const DEBOUNCE_MS = 250;
const FEATURED_CARD_MAX = 9;
const PAGE_SIZE = 18;
const BROWSE_MIN_RECRUITING_COUNT = 5;

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function matchesCondition(condition: ConditionItem, query: string) {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (condition.label.toLowerCase().includes(q)) return true;
  if (condition.slug.toLowerCase().includes(q)) return true;
  if (condition.synonyms?.some((s) => s.toLowerCase().includes(q))) return true;
  return false;
}

function sortByMostTrials(list: ConditionItem[]) {
  return [...list].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function isBrowsableCondition(condition: ConditionItem) {
  return condition.source === 'seed' || condition.count >= BROWSE_MIN_RECRUITING_COUNT;
}

function getConditionDescription(condition: ConditionItem) {
  const known = CONDITION_DETAILS[condition.slug]?.description;
  if (known) return known;
  if (condition.synonyms?.length) return `Often called ${condition.synonyms[0]}.`;
  return `Clinical trials for ${condition.label} and related care.`;
}

function FeaturedCard({ condition }: { condition: ConditionItem }) {
  const [hov, setHov] = useState(false);
  const hex = getConditionHex(condition.slug);
  const description = getConditionDescription(condition);

  return (
    <Link
      href={`/conditions/${condition.slug}`}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="flex flex-col gap-3.5 rounded-2xl border border-border/45 p-7 no-underline transition-all duration-200"
      style={{
        background: hov ? `${hex}09` : '#fff',
        boxShadow: hov ? '0 8px 40px rgba(0,0,0,0.07)' : '0 2px 6px rgba(0,0,0,0.03)',
      }}
    >
      <div>
        <div
          className="font-display font-light leading-[0.92] tracking-[-0.04em] tabular-nums"
          style={{ fontSize: 56, color: hex }}
        >
          {condition.count.toLocaleString()}
        </div>
        <div className="mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
          recruiting trials
        </div>
      </div>
      <div className="flex-1">
        <div className="mb-1.5 text-[17px] font-semibold text-foreground">{condition.label}</div>
        <p className="line-clamp-2 text-[13.5px] leading-[1.55] text-muted-foreground">{description}</p>
      </div>
      <div className="flex justify-end">
        <span
          className="text-[13px] font-semibold transition-colors duration-150"
          style={{ color: hov ? hex : '#9CA3AF' }}
        >
          View trials →
        </span>
      </div>
    </Link>
  );
}

function ConditionRow({ condition }: { condition: ConditionItem }) {
  const [hov, setHov] = useState(false);
  const hex = getConditionHex(condition.slug);

  return (
    <Link
      href={`/conditions/${condition.slug}`}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="flex w-full items-center rounded-lg px-2.5 py-[13px] no-underline transition-all duration-[120ms]"
      style={{ background: hov ? `${hex}07` : 'transparent' }}
    >
      <span
        className="mr-3 shrink-0 rounded-full transition-shadow duration-150"
        style={{
          width: 8,
          height: 8,
          background: hex,
          boxShadow: hov ? `0 0 0 3px ${hex}22` : 'none',
        }}
      />
      <span
        className="flex-1 text-[15px] font-medium transition-colors duration-[120ms]"
        style={{ color: hov ? '#1F2933' : '#3D4A57' }}
      >
        {condition.label}
      </span>
      <span className="mr-2.5 tabular-nums text-[13px] font-medium text-muted-foreground/60">
        {condition.count.toLocaleString()}
      </span>
      <span
        className="min-w-[14px] text-[13px] transition-colors duration-[120ms]"
        style={{ color: hov ? hex : 'transparent' }}
      >
        →
      </span>
    </Link>
  );
}

// ── Main component ───────────────────────────────────────────────

type ConditionsClientProps = {
  catalog: ConditionCatalog;
  initialQuery: string;
  initialIncludeEmpty: boolean;
};

export default function ConditionsClient({
  catalog,
  initialQuery,
  initialIncludeEmpty,
}: ConditionsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams?.toString() ?? '';

  const [query, setQuery] = useState(initialQuery);
  const [includeEmpty] = useState(initialIncludeEmpty);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [searchResults, setSearchResults] = useState<ConditionItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => { mountedRef.current = true; }, []);

  useEffect(() => {
    if (!mountedRef.current) return;
    const trimmed = query.trim();
    const params = new URLSearchParams();
    if (trimmed) params.set('q', trimmed);
    if (includeEmpty) params.set('includeEmpty', 'true');
    const nextString = params.toString();
    if (nextString === searchParamsString) return;
    router.replace(nextString ? `/conditions?${nextString}` : '/conditions', { scroll: false });
  }, [query, includeEmpty, router, searchParamsString]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [query]);

  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);
  const q = debouncedQuery.trim();

  useEffect(() => {
    if (q.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    setSearchLoading(true);
    fetch(`/api/conditions?query=${encodeURIComponent(q)}&limit=60`, {
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((payload) => {
        if (Array.isArray(payload?.conditions)) {
          setSearchResults(payload.conditions);
        } else {
          setSearchResults([]);
        }
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') setSearchResults([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearchLoading(false);
      });

    return () => controller.abort();
  }, [q]);

  const activeList = useMemo(
    () => (includeEmpty ? catalog.all : catalog.all.filter((i) => i.count > 0)),
    [catalog.all, includeEmpty],
  );

  const browseList = useMemo(
    () => activeList.filter(isBrowsableCondition),
    [activeList],
  );

  const featuredCards = useMemo(
    () => sortByMostTrials(
      activeList.filter((condition) => condition.source === 'seed' && condition.count > 0),
    ).slice(0, FEATURED_CARD_MAX),
    [activeList],
  );

  const filtered = useMemo(
    () => {
      if (q.length >= 2) {
        return searchResults.filter((i) => matchesCondition(i, debouncedQuery));
      }
      return browseList.filter((i) => matchesCondition(i, debouncedQuery));
    },
    [browseList, debouncedQuery, q, searchResults],
  );

  const sorted = useMemo(() => sortByMostTrials(filtered), [filtered]);
  const visibleConditions = useMemo(() => sorted.slice(0, visibleCount), [sorted, visibleCount]);
  const hasMore = visibleCount < sorted.length;

  const handleClearQuery = useCallback(() => setQuery(''), []);
  const handleLoadMore = useCallback(() => setVisibleCount((p) => p + PAGE_SIZE), []);

  return (
    <div>
      {/* Page header */}
      <section className="relative overflow-hidden border-b border-border/40 pb-14 pt-16">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 55% 70% at 95% 50%, rgba(45,155,112,0.05), transparent)',
          }}
        />
        <div className="pm-container relative">
          <div className="max-w-[680px]">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              Condition Directory
            </div>
            <h1
              className="mb-4 font-display font-normal text-balance text-foreground leading-[1.1] tracking-[-0.02em]"
              style={{ fontSize: 'clamp(34px,4vw,52px)' }}
            >
              Find trials for your condition.
            </h1>
            <p className="mb-8 max-w-[500px] text-[17px] leading-relaxed text-muted-foreground">
              Browse conditions with actively recruiting clinical studies. Counts are refreshed daily.
            </p>

            {/* Search */}
            <div className="relative max-w-[480px]">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search conditions…"
                className="w-full rounded-xl border border-border/50 bg-white py-[13px] pl-10 pr-10 text-[15px] text-foreground shadow-sm outline-none transition-colors focus:border-primary/40"
              />
              {query && (
                <button
                  onClick={handleClearQuery}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <div className="pm-container pb-24 pt-14">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-[15px] text-muted-foreground">
            {searchLoading ? 'Searching conditions...' : `No conditions found for "${query}". Try a different term.`}
          </div>
        ) : (
          <>
            {/* Directory */}
            <section>
              {!q && featuredCards.length > 0 && (
                <div className="mb-16">
                  <div className="mb-6 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
                    Most active
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {featuredCards.map((c) => (
                      <FeaturedCard key={c.slug} condition={c} />
                    ))}
                  </div>
                </div>
              )}

              {/* Sort + count row */}
              <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
                    {q ? `Matching "${query}"` : 'Popular conditions'}
                  </span>
                  {q && (
                    <span className="text-[11px] tabular-nums text-muted-foreground/40">
                      {filtered.length.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="border-t border-border/40">
                {visibleConditions.map((c) => (
                  <ConditionRow key={c.slug} condition={c} />
                ))}
              </div>
              {hasMore && (
                <div className="mt-10 flex justify-center">
                  <button
                    onClick={handleLoadMore}
                    className="rounded-lg border border-border px-6 py-2.5 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-warm-sage/40"
                  >
                    Load more conditions
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

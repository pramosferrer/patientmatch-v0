'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ConditionCatalog, ConditionItem } from '@/shared/conditions.catalog';
import { CONDITION_DETAILS } from '@/shared/conditions';
import { getConditionHex } from '@/components/icons/ConditionIcon';
import { Search, ArrowUpDown, AlignLeft } from 'lucide-react';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

type SortKey = 'az' | 'trials' | 'recent';

const DEBOUNCE_MS = 250;
const POPULAR_MAX = 6;
const PAGE_SIZE = 18;

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

function sortConditions(list: ConditionItem[], sort: SortKey) {
  const next = [...list];
  if (sort === 'trials') return next.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  if (sort === 'recent') {
    const ts = (i: ConditionItem) => (i.lastUpdated ? Date.parse(i.lastUpdated) || 0 : 0);
    return next.sort((a, b) => ts(b) - ts(a) || b.count - a.count || a.label.localeCompare(b.label));
  }
  return next.sort((a, b) => a.label.localeCompare(b.label));
}

function getConditionDescription(condition: ConditionItem) {
  const known = CONDITION_DETAILS[condition.slug]?.description;
  if (known) return known;
  if (condition.synonyms?.length) return `Often called ${condition.synonyms[0]}.`;
  return `Clinical trials for ${condition.label} and related care.`;
}

// ── Sub-components ──────────────────────────────────────────────

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
  initialSort: SortKey;
};

export default function ConditionsClient({
  catalog,
  initialQuery,
  initialIncludeEmpty,
  initialSort,
}: ConditionsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams?.toString() ?? '';

  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [includeEmpty] = useState(initialIncludeEmpty);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const mountedRef = useRef(false);

  useEffect(() => { mountedRef.current = true; }, []);

  useEffect(() => {
    if (!mountedRef.current) return;
    const trimmed = query.trim();
    const params = new URLSearchParams();
    if (trimmed) params.set('q', trimmed);
    if (includeEmpty) params.set('includeEmpty', 'true');
    if (sort !== 'az') params.set('sort', sort);
    const nextString = params.toString();
    if (nextString === searchParamsString) return;
    router.replace(nextString ? `/conditions?${nextString}` : '/conditions', { scroll: false });
  }, [query, includeEmpty, sort, router, searchParamsString]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [query]);

  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);

  const baseList = useMemo(
    () => (includeEmpty ? catalog.all : catalog.all.filter((i) => i.count > 0)),
    [catalog.all, includeEmpty],
  );

  const filtered = useMemo(
    () => baseList.filter((i) => matchesCondition(i, debouncedQuery)),
    [baseList, debouncedQuery],
  );

  const sorted = useMemo(() => sortConditions(filtered, sort), [filtered, sort]);
  const showGrouping = debouncedQuery.trim().length === 0 && sort === 'az';

  const popular = useMemo(() => {
    if (!showGrouping) return [];
    return [...filtered].filter((i) => i.count > 0).sort((a, b) => b.count - a.count).slice(0, POPULAR_MAX);
  }, [filtered, showGrouping]);

  const popularSlugs = useMemo(() => new Set(popular.map((i) => i.slug)), [popular]);

  const allConditions = useMemo(
    () => (showGrouping ? sorted.filter((i) => !popularSlugs.has(i.slug)) : sorted),
    [popularSlugs, showGrouping, sorted],
  );

  const visibleConditions = useMemo(() => allConditions.slice(0, visibleCount), [allConditions, visibleCount]);
  const hasMore = visibleCount < allConditions.length;
  const totalAll = catalog.all.length;

  // Alphabet grouping for A-Z sort (no active search)
  const isAzGrouped = sort === 'az' && debouncedQuery.trim().length === 0;

  const alphabetGroups = useMemo(() => {
    if (!isAzGrouped) return null;
    const map = new Map<string, ConditionItem[]>();
    for (const c of allConditions) {
      const letter = c.label[0]?.toUpperCase() ?? '#';
      const key = /[A-Z]/.test(letter) ? letter : '#';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [allConditions, isAzGrouped]);

  const activeLetters = useMemo(() => {
    if (!alphabetGroups) return new Set<string>();
    return new Set(alphabetGroups.keys());
  }, [alphabetGroups]);

  const handleClearQuery = useCallback(() => setQuery(''), []);
  const handleLoadMore = useCallback(() => setVisibleCount((p) => p + PAGE_SIZE), []);

  const jumpToLetter = useCallback((letter: string) => {
    const el = document.getElementById(`alpha-${letter}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const q = debouncedQuery.trim();

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
              Browse {totalAll}+ conditions with actively recruiting clinical studies. Real counts, refreshed daily.
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
            No conditions found for &ldquo;{query}&rdquo;. Try a different term.
          </div>
        ) : (
          <>
            {/* Featured "Most active" */}
            {showGrouping && popular.length > 0 && (
              <section className="mb-16">
                <div className="mb-6 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
                  Most active
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {popular.map((c) => (
                    <FeaturedCard key={c.slug} condition={c} />
                  ))}
                </div>
              </section>
            )}

            {/* Directory */}
            <section>
              {/* Sort + count row */}
              <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
                    {q ? `Matching "${query}"` : 'All conditions'}
                  </span>
                  <span className="text-[11px] tabular-nums text-muted-foreground/40">
                    {q ? filtered.length : allConditions.length}
                  </span>
                </div>
                {/* Sort toggles */}
                <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-white p-1 shadow-sm">
                  <button
                    onClick={() => { setSort('az'); setVisibleCount(PAGE_SIZE); }}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all ${sort === 'az' ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <AlignLeft size={11} />
                    A–Z
                  </button>
                  <button
                    onClick={() => { setSort('trials'); setVisibleCount(PAGE_SIZE); }}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all ${sort === 'trials' ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <ArrowUpDown size={11} />
                    Most trials
                  </button>
                </div>
              </div>

              {/* Alphabet quick-jump strip (A-Z mode, no search) */}
              {isAzGrouped && (
                <div className="mb-6 flex flex-wrap gap-1">
                  {ALPHABET.map((letter) => (
                    <button
                      key={letter}
                      onClick={() => jumpToLetter(letter)}
                      disabled={!activeLetters.has(letter)}
                      className={`h-7 w-7 rounded text-[12px] font-semibold transition-all ${
                        activeLetters.has(letter)
                          ? 'text-foreground hover:bg-primary hover:text-white'
                          : 'text-muted-foreground/25 cursor-default'
                      }`}
                    >
                      {letter}
                    </button>
                  ))}
                </div>
              )}

              {/* A-Z grouped list */}
              {isAzGrouped && alphabetGroups ? (
                <div className="border-t border-border/40">
                  {ALPHABET.filter((l) => alphabetGroups.has(l)).map((letter) => (
                    <div key={letter} id={`alpha-${letter}`} className="scroll-mt-24">
                      <div className="sticky top-[64px] z-10 flex items-center gap-3 bg-background/95 backdrop-blur-sm py-2 border-b border-border/30">
                        <span className="font-display text-[22px] font-light leading-none text-primary/40 w-7 text-center tabular-nums">
                          {letter}
                        </span>
                        <span className="text-[11px] text-muted-foreground/40 tabular-nums">
                          {alphabetGroups.get(letter)!.length}
                        </span>
                      </div>
                      {alphabetGroups.get(letter)!.map((c) => (
                        <ConditionRow key={c.slug} condition={c} />
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                /* Flat list (search results or "Most trials" sort) */
                <>
                  <div className="border-t border-border/40">
                    {(q ? filtered : visibleConditions).map((c) => (
                      <ConditionRow key={c.slug} condition={c} />
                    ))}
                  </div>
                  {!q && hasMore && (
                    <div className="mt-10 flex justify-center">
                      <button
                        onClick={handleLoadMore}
                        className="rounded-lg border border-border px-6 py-2.5 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-warm-sage/40"
                      >
                        Load more conditions
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

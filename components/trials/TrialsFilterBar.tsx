'use client';

import { useState, useEffect, useCallback, useRef, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, ChevronDown, X, SlidersHorizontal, Check, MapPin, List, Map } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { updateProfileBatch } from '@/app/actions';
import { toConditionLabel } from '@/shared/conditions-normalize';

// ─── Constants ───────────────────────────────────────────────────────────────

const PHASE_OPTIONS = [
  { value: '1', label: 'Phase 1', sub: 'Early / experimental' },
  { value: '2', label: 'Phase 2', sub: 'Safety & efficacy' },
  { value: '3', label: 'Phase 3', sub: 'Large-scale' },
  { value: '4', label: 'Phase 4', sub: 'Post-approval' },
];

const STATUS_OPTIONS = [
  { value: 'recruiting',                label: 'Recruiting now' },
  { value: 'not_yet_recruiting',        label: 'Opening soon' },
  { value: 'enrolling_by_invitation',   label: 'By invitation' },
];

const SEX_OPTIONS = [
  { value: '',       label: 'Any' },
  { value: 'female', label: 'Female' },
  { value: 'male',   label: 'Male' },
];

const DISTANCE_OPTIONS = [10, 25, 50, 100];
const SORT_OPTIONS_NATIONWIDE = [{ id: 'recruiting', label: 'Recruiting first' }];
const SORT_OPTIONS_LOCAL = [
  { id: 'distance',   label: 'Nearest first' },
  { id: 'recruiting', label: 'Recruiting first' },
];
const DEBOUNCE_MS = 400;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ActiveChip = {
  key: string;
  label: string;
  removeFn: () => void;
};

type TrialsFilterBarProps = {
  totalCount: number;
  effectiveCondition: string;
  effectiveZip: string;
  expansionApplied?: boolean;
  expansionNearestMiles?: number | null;
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function TrialsFilterBar({
  totalCount,
  effectiveCondition,
  effectiveZip,
  expansionApplied = false,
  expansionNearestMiles = null,
}: TrialsFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // ── Read URL state ──────────────────────────────────────────────────────────
  const condition    = searchParams.get('condition') || '';
  const view         = searchParams.get('view') || 'list';
  const zip          = searchParams.get('zip') || '';
  const radius       = parseInt(searchParams.get('radius') || '50', 10);
  const age          = searchParams.get('age') || '';
  const sex          = searchParams.get('sex') || '';
  const sort         = searchParams.get('sort') || '';
  const q            = searchParams.get('q') || '';
  const phasesParam  = searchParams.get('phases') || '';
  const statusParam  = searchParams.get('status_bucket') || '';

  const phases        = phasesParam ? phasesParam.split(',').filter(Boolean) : [];
  const statusBuckets = statusParam ? statusParam.split(',').filter(Boolean) : [];
  const isNationwide  = !zip || zip.trim() === '';
  const sortOptions   = isNationwide ? SORT_OPTIONS_NATIONWIDE : SORT_OPTIONS_LOCAL;
  const defaultSort   = isNationwide ? 'recruiting' : 'distance';
  const activeSort    = sort || defaultSort;

  // ── Local state ─────────────────────────────────────────────────────────────
  const [conditionOpen,  setConditionOpen]  = useState(false);
  const [locationOpen,   setLocationOpen]   = useState(false);
  const [moreOpen,       setMoreOpen]       = useState(false);
  const [sortOpen,       setSortOpen]       = useState(false);

  const [conditionQuery, setConditionQuery] = useState('');
  const [allConditions,  setAllConditions]  = useState<{ slug: string; label: string }[]>([]);
  const [localZip,       setLocalZip]       = useState(zip);
  const [localRadius,    setLocalRadius]    = useState(radius);
  const [localAge,       setLocalAge]       = useState(age);
  const [localSex,       setLocalSex]       = useState(sex);
  const [localPhases,    setLocalPhases]    = useState<string[]>(phases);
  const [localStatuses,  setLocalStatuses]  = useState<string[]>(statusBuckets);
  const [zipError,       setZipError]       = useState<string | null>(null);
  const [searchInput,    setSearchInput]    = useState(q);
  const debouncedSearch = useDebounce(searchInput, DEBOUNCE_MS);
  const debouncedConditionQuery = useDebounce(conditionQuery, 180);

  // Sync local state when URL changes (e.g. back/forward navigation)
  useEffect(() => { setLocalZip(zip); }, [zip]);
  useEffect(() => { setLocalRadius(radius); }, [radius]);
  useEffect(() => { setLocalAge(age); }, [age]);
  useEffect(() => { setLocalSex(sex); }, [sex]);
  useEffect(() => { setLocalPhases(phases); }, [phasesParam]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setLocalStatuses(statusBuckets); }, [statusParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search → push URL (navigate/q omitted intentionally to avoid re-triggering on every push)
  useEffect(() => {
    const trimmed = debouncedSearch.trim();
    if (trimmed === q) return;
    navigate({ q: trimmed || null, page: null });
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch condition suggestions as the user types. The old behavior fetched only
  // the default top conditions, then filtered that stale subset client-side.
  useEffect(() => {
    if (!conditionOpen) return;
    const controller = new AbortController();
    fetch(`/api/conditions/suggestions?query=${encodeURIComponent(debouncedConditionQuery)}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAllConditions(data);
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') setAllConditions([]);
      });
    return () => controller.abort();
  }, [conditionOpen, debouncedConditionQuery]);

  // ── Navigation helper ───────────────────────────────────────────────────────
  const navigate = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === '') params.delete(k);
        else params.set(k, v);
      }
      params.delete('page');
      startTransition(() => {
        router.push(`/trials?${params.toString()}`);
      });
    },
    [searchParams, router],
  );

  // ── Filter handlers ─────────────────────────────────────────────────────────

  const applyCondition = (slug: string) => {
    setConditionOpen(false);
    const label = slug === 'all' ? '' : slug;
    navigate({ condition: label || null });
    updateProfileBatch({ conditions: label ? [label] : [] }).catch(() => {});
  };

  const applyLocation = () => {
    const z = localZip.trim();
    if (z && !/^\d{5}$/.test(z)) {
      setZipError('Enter a valid 5-digit ZIP.');
      return;
    }
    setZipError(null);
    setLocationOpen(false);
    navigate({
      zip: z || null,
      radius: z ? String(localRadius) : null,
      sort: z ? null : 'recruiting',
    });
    updateProfileBatch({
      zip: z || undefined,
      radius: z ? localRadius : undefined,
    }).catch(() => {});
  };

  const clearLocation = () => {
    setLocalZip('');
    setLocalRadius(50);
    setLocationOpen(false);
    navigate({ zip: null, radius: null, sort: 'recruiting' });
    updateProfileBatch({ zip: undefined, radius: undefined }).catch(() => {});
  };

  const applyMore = () => {
    setMoreOpen(false);
    const updates: Record<string, string | null> = {
      age:          localAge.trim() || null,
      sex:          localSex || null,
      phases:       localPhases.length ? localPhases.join(',') : null,
      status_bucket: localStatuses.length ? localStatuses.join(',') : null,
    };
    navigate(updates);
    updateProfileBatch({
      age:                  localAge.trim() ? parseInt(localAge, 10) : undefined,
      sex:                  (localSex as 'male' | 'female' | '') || null,
      saved_phases:         localPhases.length ? localPhases : null,
      saved_status_buckets: localStatuses.length ? localStatuses : null,
    }).catch(() => {});
  };

  const togglePhase = (v: string) =>
    setLocalPhases((prev) => prev.includes(v) ? prev.filter((p) => p !== v) : [...prev, v]);

  const toggleStatus = (v: string) =>
    setLocalStatuses((prev) => prev.includes(v) ? prev.filter((s) => s !== v) : [...prev, v]);

  const applySort = (id: string) => {
    setSortOpen(false);
    navigate({ sort: id });
  };

  // ── Active filter chips ─────────────────────────────────────────────────────
  const chips: ActiveChip[] = [];

  if (condition) {
    chips.push({
      key: 'condition',
      label: toConditionLabel(condition),
      removeFn: () => { navigate({ condition: null }); updateProfileBatch({ conditions: [] }).catch(() => {}); },
    });
  }
  if (zip) {
    chips.push({
      key: 'location',
      label: `${radius} mi of ${zip}`,
      removeFn: clearLocation,
    });
  }
  if (q) {
    chips.push({
      key: 'q',
      label: `"${q}"`,
      removeFn: () => { setSearchInput(''); navigate({ q: null }); },
    });
  }
  phases.forEach((p) => {
    const opt = PHASE_OPTIONS.find((o) => o.value === p);
    if (opt) chips.push({ key: `phase-${p}`, label: opt.label, removeFn: () => navigate({ phases: phases.filter((x) => x !== p).join(',') || null }) });
  });
  statusBuckets.forEach((s) => {
    const opt = STATUS_OPTIONS.find((o) => o.value === s);
    if (opt) chips.push({ key: `status-${s}`, label: opt.label, removeFn: () => navigate({ status_bucket: statusBuckets.filter((x) => x !== s).join(',') || null }) });
  });
  if (age) chips.push({ key: 'age', label: `Age ${age}`, removeFn: () => { setLocalAge(''); navigate({ age: null }); updateProfileBatch({ age: undefined }).catch(() => {}); } });
  if (sex) chips.push({ key: 'sex', label: sex === 'female' ? 'Female' : 'Male', removeFn: () => { setLocalSex(''); navigate({ sex: null }); updateProfileBatch({ sex: null }).catch(() => {}); } });

  const clearAll = () => {
    setSearchInput('');
    setLocalZip('');
    setLocalRadius(50);
    setLocalAge('');
    setLocalSex('');
    setLocalPhases([]);
    setLocalStatuses([]);
    startTransition(() => {
      router.push('/trials');
    });
    updateProfileBatch({ conditions: [], zip: undefined, radius: undefined, age: undefined, sex: null, saved_phases: null, saved_status_buckets: null }).catch(() => {});
  };

  // ── Derived display labels ──────────────────────────────────────────────────
  const conditionLabel = condition ? toConditionLabel(condition) : 'All conditions';
  const locationLabel  = isNationwide ? 'Nationwide' : `${radius} mi · ${zip}`;
  const moreCount = [...phases, ...statusBuckets, ...(age ? ['age'] : []), ...(sex ? ['sex'] : [])].length;

  const filteredConditions = allConditions;

  // ── Pill button base class ──────────────────────────────────────────────────
  const pill = (active?: boolean) =>
    cn(
      'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border px-3.5 py-[7px] text-[13.5px] font-medium transition-colors whitespace-nowrap cursor-pointer',
      active
        ? 'border-primary/40 bg-primary/8 text-primary'
        : 'border-border/50 bg-white text-foreground hover:border-primary/30 hover:bg-primary/5',
    );

  return (
    <div className="sticky top-16 z-30 border-b border-border/30 bg-background/97 backdrop-blur-md">
      {isPending && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-primary/10">
          <div className="h-full w-1/3 animate-[loading-bar_1.15s_ease-in-out_infinite] bg-primary" />
        </div>
      )}
      <div className="pm-container">
        {/* ── Primary filter row ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 items-center gap-2 py-3 sm:flex sm:flex-wrap">

          {/* Search */}
          <div className="relative col-span-2 min-w-0 sm:min-w-[180px] sm:flex-1 sm:max-w-[280px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search trials, drugs…"
              disabled={isPending}
              className="w-full rounded-full border border-border/50 bg-white py-[7px] pl-8.5 pr-8 text-[13.5px] text-foreground shadow-none outline-none transition-colors focus:border-primary/40 placeholder:text-muted-foreground/55"
              style={{ paddingLeft: '2rem' }}
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(''); navigate({ q: null }); }}
                disabled={isPending}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Condition */}
          <Popover open={conditionOpen} onOpenChange={setConditionOpen}>
            <PopoverTrigger asChild>
              <button className={pill(!!condition)} disabled={isPending}>
                {conditionLabel}
                <ChevronDown size={11} className="opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 rounded-xl border border-border/60 bg-white p-0 shadow-card" align="start">
              <div className="border-b border-border/40 p-3">
                <Input
                  autoFocus
                  value={conditionQuery}
                  onChange={(e) => setConditionQuery(e.target.value)}
                  placeholder="Search conditions…"
                  className="h-8 rounded-lg text-sm"
                />
              </div>
              <div className="max-h-60 overflow-y-auto p-1.5">
                <button
                  onClick={() => applyCondition('all')}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13.5px] transition-colors',
                    !condition ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-secondary/50 text-foreground',
                  )}
                >
                  All conditions
                  {!condition && <Check size={13} className="text-primary" />}
                </button>
                {filteredConditions.slice(0, 20).map((c) => (
                  <button
                    key={c.slug}
                    onClick={() => applyCondition(c.slug)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13.5px] transition-colors',
                      condition === c.slug ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-secondary/50 text-foreground',
                    )}
                  >
                    {c.label}
                    {condition === c.slug && <Check size={13} className="text-primary" />}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Location */}
          <Popover open={locationOpen} onOpenChange={(o) => { setLocationOpen(o); if (!o) setZipError(null); }}>
            <PopoverTrigger asChild>
              <button className={pill(!!zip)}>
                <MapPin size={12} className="opacity-70" />
                {locationLabel}
                <ChevronDown size={11} className="opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 rounded-xl border border-border/60 bg-white p-4 shadow-card" align="start">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
                Location
              </p>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="fb-zip" className="text-xs">ZIP code</Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      id="fb-zip"
                      value={localZip}
                      onChange={(e) => { setLocalZip(e.target.value.replace(/\D/g, '').slice(0, 5)); setZipError(null); }}
                      onKeyDown={(e) => e.key === 'Enter' && applyLocation()}
                      placeholder="e.g. 94107"
                      inputMode="numeric"
                      maxLength={5}
                      className="h-9 flex-1 rounded-lg text-sm"
                    />
                    <Button size="sm" variant="brand" onClick={applyLocation} disabled={isPending} className="h-9 px-4">
                      {isPending ? 'Applying...' : 'Apply'}
                    </Button>
                  </div>
                  {zipError && <p className="mt-1 text-xs text-destructive">{zipError}</p>}
                </div>

                {localZip.length === 5 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Search radius</Label>
                      <span className="text-xs font-semibold text-primary">{localRadius} mi</span>
                    </div>
                    <Slider
                      value={[Math.max(0, DISTANCE_OPTIONS.indexOf(localRadius))]}
                      min={0}
                      max={DISTANCE_OPTIONS.length - 1}
                      step={1}
                      onValueChange={(v) => setLocalRadius(DISTANCE_OPTIONS[v[0]])}
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                      {DISTANCE_OPTIONS.map((d) => <span key={d}>{d} mi</span>)}
                    </div>
                  </div>
                )}

                {zip && (
                  <button
                    onClick={clearLocation}
                    className="text-xs font-medium text-primary transition-opacity hover:opacity-75"
                  >
                    Search nationwide instead
                  </button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Status quick-picks: only show if no status filter active */}
          {statusBuckets.length === 0 && (
            <button
              onClick={() => navigate({ status_bucket: 'recruiting' })}
              disabled={isPending}
              className={pill(false)}
            >
              Recruiting only
            </button>
          )}

          {/* More filters */}
          <Popover open={moreOpen} onOpenChange={setMoreOpen}>
            <PopoverTrigger asChild>
              <button className={pill(moreCount > 0)} disabled={isPending}>
                <SlidersHorizontal size={12} className="opacity-70" />
                {moreCount > 0 ? `Filters · ${moreCount}` : 'More filters'}
                <ChevronDown size={11} className="opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 rounded-xl border border-border/60 bg-white p-0 shadow-card" align="start">
              <div className="max-h-[70vh] overflow-y-auto">
                {/* Phase */}
                <div className="border-b border-border/40 p-4">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
                    Trial phase
                  </p>
                  <div className="space-y-2">
                    {PHASE_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 transition-colors hover:bg-secondary/40">
                        <div
                          className={cn(
                            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                            localPhases.includes(opt.value)
                              ? 'border-primary bg-primary text-white'
                              : 'border-border/60 bg-white',
                          )}
                          onClick={() => togglePhase(opt.value)}
                        >
                          {localPhases.includes(opt.value) && <Check size={10} />}
                        </div>
                        <div onClick={() => togglePhase(opt.value)}>
                          <div className="text-[13.5px] font-medium text-foreground">{opt.label}</div>
                          <div className="text-[12px] text-muted-foreground">{opt.sub}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div className="border-b border-border/40 p-4">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
                    Enrollment status
                  </p>
                  <div className="space-y-2">
                    {STATUS_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-secondary/40">
                        <div
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                            localStatuses.includes(opt.value)
                              ? 'border-primary bg-primary text-white'
                              : 'border-border/60 bg-white',
                          )}
                          onClick={() => toggleStatus(opt.value)}
                        >
                          {localStatuses.includes(opt.value) && <Check size={10} />}
                        </div>
                        <span className="text-[13.5px] font-medium text-foreground" onClick={() => toggleStatus(opt.value)}>
                          {opt.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Age */}
                <div className="border-b border-border/40 p-4">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
                    Your age
                  </p>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={localAge}
                    onChange={(e) => setLocalAge(e.target.value)}
                    placeholder="e.g. 45"
                    min={0}
                    max={120}
                    className="h-9 max-w-[140px] rounded-lg text-sm"
                  />
                  <p className="mt-1.5 text-[12px] text-muted-foreground">Removes trials you won&apos;t qualify for by age.</p>
                </div>

                {/* Sex */}
                <div className="p-4">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
                    Sex at birth
                  </p>
                  <div className="flex gap-2">
                    {SEX_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setLocalSex(opt.value)}
                        className={cn(
                          'flex-1 rounded-lg border py-2 text-[13px] font-medium transition-colors',
                          localSex === opt.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border/50 bg-white text-foreground hover:bg-secondary/40',
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Apply footer */}
              <div className="border-t border-border/40 p-3 flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    setLocalPhases([]);
                    setLocalStatuses([]);
                    setLocalAge('');
                    setLocalSex('');
                  }}
                  className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Clear
                </button>
                <Button size="sm" variant="brand" onClick={applyMore} disabled={isPending} className="h-8 px-5">
                  {isPending ? 'Applying...' : 'Apply filters'}
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Sort + count + view toggle — pushed right */}
          <div className="col-span-2 mt-1 flex w-full items-center justify-between gap-2 rounded-xl border border-border/40 bg-white/80 p-2 sm:ml-auto sm:mt-0 sm:w-auto sm:border-0 sm:bg-transparent sm:p-0">
            <span className="text-[13px] tabular-nums text-muted-foreground/70 whitespace-nowrap">
              {totalCount.toLocaleString()} trials
            </span>

            {/* List / Map toggle */}
            <div className="flex items-center rounded-full border border-border/50 bg-white p-0.5">
              <button
                onClick={() => navigate({ view: null })}
                disabled={isPending}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-medium transition-colors',
                  view !== 'map'
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <List size={11} />
                List
              </button>
              <button
                onClick={() => navigate({ view: 'map' })}
                disabled={isPending}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-medium transition-colors',
                  view === 'map'
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Map size={11} />
                Map
              </button>
            </div>

            <Popover open={sortOpen} onOpenChange={setSortOpen}>
              <PopoverTrigger asChild>
                <button disabled={isPending} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
                  {sortOptions.find((s) => s.id === activeSort)?.label ?? sortOptions[0].label}
                  <ChevronDown size={11} className="opacity-60" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-44 rounded-xl border border-border/60 bg-white p-1.5 shadow-card" align="end">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => applySort(opt.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[13px] transition-colors',
                      activeSort === opt.id ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-secondary/50 text-foreground',
                    )}
                  >
                    {opt.label}
                    {activeSort === opt.id && <Check size={12} className="text-primary" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* ── Active filter chips ─────────────────────────────────────────── */}
        {chips.length > 0 && (
          <div className="-mx-4 flex flex-nowrap items-center gap-2 overflow-x-auto px-4 pb-3 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-2.5">
            {chips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/8 px-3 py-[5px] text-[12.5px] font-medium text-primary"
              >
                {chip.label}
                <button
                  onClick={chip.removeFn}
                  className="rounded-full transition-opacity hover:opacity-60"
                  aria-label={`Remove ${chip.label} filter`}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            {chips.length > 1 && (
              <button
                onClick={clearAll}
                className="shrink-0 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Expansion notice: radius had no results, showing nearest instead ── */}
      {expansionApplied && zip && (
        <div className="border-t border-amber-100 bg-amber-50/70 py-2.5">
          <div className="pm-container flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12.5px] text-amber-800">
              No {effectiveCondition || 'trial'} sites found within your search radius
              {expansionNearestMiles != null ? ` — nearest is ${expansionNearestMiles} miles away` : ''}.
              Showing closest matches instead.
            </p>
            <div className="flex items-center gap-2">
              {[100, 200].map((mi) => (
                <button
                  key={mi}
                  onClick={() => navigate({ radius: String(mi) })}
                  className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[12px] font-medium text-amber-800 transition-colors hover:bg-amber-100"
                >
                  Expand to {mi} mi
                </button>
              ))}
              <button
                onClick={() => navigate({ zip: null, radius: null })}
                className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[12px] font-medium text-amber-800 transition-colors hover:bg-amber-100"
              >
                Search nationwide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cold-arrival prompt ─────────────────────────────────────────────── */}
      {!condition && !zip && !q && totalCount > 0 && (
        <ColdArrivalBanner navigate={navigate} />
      )}
    </div>
  );
}

// ─── Cold-arrival inline banner ───────────────────────────────────────────────

function ColdArrivalBanner({
  navigate,
}: {
  navigate: (updates: Record<string, string | null>) => void;
}) {
  const [cond, setCond] = useState('');
  const [z, setZ]       = useState('');

  const handleApply = () => {
    if (!cond.trim()) return;
    const updates: Record<string, string | null> = { condition: cond.trim() };
    if (z.trim().length === 5) updates.zip = z.trim();
    navigate(updates);
    updateProfileBatch({
      conditions: [cond.trim()],
      ...(z.trim().length === 5 ? { zip: z.trim() } : {}),
    }).catch(() => {});
  };

  return (
    <div className="border-t border-border/30 bg-background py-4">
      <div className="pm-container">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px] max-w-[280px]">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
              Condition
            </label>
            <input
              value={cond}
              onChange={(e) => setCond(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApply()}
              placeholder="e.g. Long COVID"
              className="w-full rounded-xl border border-border/50 bg-white px-3.5 py-2.5 text-[14px] text-foreground outline-none transition-colors focus:border-primary/40"
            />
          </div>
          <div className="w-[120px]">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
              ZIP code <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              value={z}
              onChange={(e) => setZ(e.target.value.replace(/\D/g, '').slice(0, 5))}
              onKeyDown={(e) => e.key === 'Enter' && handleApply()}
              placeholder="94107"
              inputMode="numeric"
              maxLength={5}
              className="w-full rounded-xl border border-border/50 bg-white px-3.5 py-2.5 text-[14px] text-foreground outline-none transition-colors focus:border-primary/40"
            />
          </div>
          <Button
            variant="brand"
            onClick={handleApply}
            disabled={!cond.trim()}
            className="h-10 px-5 text-[14px]"
          >
            Show my trials →
          </Button>
          <p className="w-full text-[12px] text-muted-foreground/70">
            Or scroll to browse all {/* totalCount passed from parent if needed */} recruiting trials below.
          </p>
        </div>
      </div>
    </div>
  );
}

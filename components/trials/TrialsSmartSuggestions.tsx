'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'pm_smart_suggestions_dismissed';
const DISMISS_TTL_MS = 30 * 60 * 1000; // 30 min

type Suggestion = {
  id: string;
  label: string;
  count: number;
  action: Record<string, string | null>;
};

type TrialsSmartSuggestionsProps = {
  totalCount: number;
  recruitingCount: number | null;
  phase2plusCount: number | null;
  currentCondition: string;
  currentStatusBucket: string;
  currentPhases: string[];
};

export default function TrialsSmartSuggestions({
  totalCount,
  recruitingCount,
  phase2plusCount,
  currentCondition,
  currentStatusBucket,
  currentPhases,
}: TrialsSmartSuggestionsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid SSR flash

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw) {
        const { at } = JSON.parse(raw);
        if (Date.now() - at < DISMISS_TTL_MS) return; // still within TTL — keep dismissed
      }
    } catch {}
    setDismissed(false);
  }, []);

  if (dismissed) return null;

  // Build relevant suggestions based on current state
  const suggestions: Suggestion[] = [];

  if (
    recruitingCount !== null &&
    recruitingCount > 0 &&
    (!currentStatusBucket || currentStatusBucket === 'all') &&
    totalCount > recruitingCount
  ) {
    suggestions.push({
      id: 'recruiting',
      label: `Recruiting only`,
      count: recruitingCount,
      action: { status_bucket: 'recruiting', page: null },
    });
  }

  if (
    phase2plusCount !== null &&
    phase2plusCount > 0 &&
    currentPhases.length === 0 &&
    totalCount > phase2plusCount
  ) {
    suggestions.push({
      id: 'phase2plus',
      label: `Phase 2+ trials`,
      count: phase2plusCount,
      action: { phases: '2,3,4', page: null },
    });
  }

  // Only render when there's at least one useful suggestion and enough trials
  if (suggestions.length === 0 || totalCount <= 50) return null;

  const navigate = (action: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(action)) {
      if (v === null || v === '') params.delete(k);
      else params.set(k, v);
    }
    params.delete('page');
    router.push(`/trials?${params.toString()}`);
    dismiss();
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify({ at: Date.now() }));
    } catch {}
  };

  return (
    <div className="border-b border-border/30 bg-[#F4F7F5] py-2.5">
      <div className="pm-container flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">
          <Sparkles size={11} className="text-primary/70" />
          Narrow it down
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(s.action)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-white px-3 py-[5px]',
                'text-[12.5px] font-medium text-primary transition-all hover:bg-primary/8 hover:border-primary/40',
              )}
            >
              {s.label}
              <span className="text-[11.5px] font-normal text-primary/60 tabular-nums">
                ({s.count.toLocaleString()})
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={dismiss}
          className="ml-auto text-muted-foreground/50 transition-colors hover:text-muted-foreground"
          aria-label="Dismiss suggestions"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

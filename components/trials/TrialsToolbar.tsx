'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ArrowUpDown, ChevronDown, Check, RotateCcw } from 'lucide-react';
import { deriveTrialsState } from '@/hooks/useTrialsState';

type TrialsToolbarProps = {
    totalCount: number;
    shownCount: number;
    zip?: string | null;
    onReset?: () => void;
};

export default function TrialsToolbar({
    totalCount,
    shownCount,
    zip,
    onReset,
}: TrialsToolbarProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const currentSort = searchParams.get('sort') || (zip ? 'distance' : 'recruiting');

    // Get sort options from centralized state
    const { sortOptions, isNationwide } = deriveTrialsState({ zip });

    const handleSortChange = (newSort: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('sort', newSort);
        params.delete('page');
        router.push(`/trials?${params.toString()}`);
    };

    const handleReset = () => {
        if (onReset) {
            onReset();
        } else {
            router.push('/trials');
        }
    };

    const handleGuidedSetup = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('intake', '1');
        params.delete('page');
        router.push(`/trials?${params.toString()}`);
    };

    // Get current sort label
    const currentSortLabel = sortOptions.find((s) => s.id === currentSort)?.label
        || (isNationwide ? 'Recruiting first' : 'Nearest first');

    return (
        <div className="flex flex-wrap items-center justify-between gap-4 py-4">
            {/* Left: Count display - more prominent */}
            <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums text-foreground">
                    {shownCount.toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground">
                    of {totalCount.toLocaleString()} trials
                </span>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-2">
                {/* Sort Dropdown - pill shape */}
                <Popover>
                    <PopoverTrigger asChild>
                        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border/50 text-sm font-medium text-foreground hover:bg-secondary/40 hover:border-border transition-all shadow-sm">
                            <ArrowUpDown size={14} className="text-muted-foreground" />
                            <span className="hidden sm:inline text-muted-foreground">Sort:</span>
                            <span className="font-semibold">{currentSortLabel}</span>
                            <ChevronDown size={12} className="text-muted-foreground ml-1" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-52 bg-card shadow-warm rounded-xl border border-border/50 p-1.5" align="end">
                        <div className="flex flex-col gap-0.5">
                            {sortOptions.map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => handleSortChange(option.id)}
                                    className={cn(
                                        'w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors flex items-center justify-between',
                                        currentSort === option.id
                                            ? 'bg-primary/10 text-primary font-semibold'
                                            : 'hover:bg-secondary/60 text-foreground'
                                    )}
                                >
                                    {option.label}
                                    {currentSort === option.id && <Check size={14} className="text-primary" />}
                                </button>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Reset - subtle text button */}
                <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary/40"
                    title="Reset all filters"
                >
                    <RotateCcw size={14} />
                    <span className="hidden sm:inline">Reset</span>
                </button>

                <button
                    type="button"
                    onClick={handleGuidedSetup}
                    className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
                    title="Personalize these results"
                >
                    <span className="hidden sm:inline">Personalize results</span>
                </button>
            </div>
        </div>
    );
}

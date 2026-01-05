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

    const handleReset = async () => {
        if (onReset) {
            onReset();
        } else {
            // Clear cookie values before navigating
            const { clearSearchProfile } = await import('@/app/actions');
            await clearSearchProfile();
            window.location.href = '/trials';
        }
    };

    // Get current sort label
    const currentSortLabel = sortOptions.find((s) => s.id === currentSort)?.label
        || (isNationwide ? 'Recruiting first' : 'Nearest first');

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-slate-100">
            {/* Left: Count */}
            <p className="text-sm text-slate-500">
                Showing{' '}
                <span className="font-semibold text-slate-700">
                    {shownCount.toLocaleString()}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-slate-700">
                    {totalCount.toLocaleString()}
                </span>{' '}
                trials
            </p>

            {/* Right: Sort + Reset */}
            <div className="flex items-center gap-4">
                {/* Sort Dropdown */}
                <Popover>
                    <PopoverTrigger asChild>
                        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-none bg-slate-100 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-all">
                            <ArrowUpDown size={12} className="text-slate-400" />
                            <span>
                                Sort: <span className="text-slate-900">{currentSortLabel}</span>
                            </span>
                            <ChevronDown size={12} className="opacity-40" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-44 bg-white shadow-xl rounded-none p-2" align="end">
                        <div className="grid grid-cols-1 gap-0.5">
                            {sortOptions.map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => handleSortChange(option.id)}
                                    className={cn(
                                        'w-full text-left px-3 py-1.5 text-xs rounded-none transition-all flex items-center justify-between',
                                        currentSort === option.id
                                            ? 'bg-[#F26A57]/5 text-[#F26A57] font-semibold'
                                            : 'hover:bg-slate-50 text-slate-700'
                                    )}
                                >
                                    {option.label}
                                    {currentSort === option.id && <Check size={14} />}
                                </button>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Reset Text Link */}
                <button
                    onClick={handleReset}
                    className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-[#F26A57] transition-colors"
                >
                    <RotateCcw size={12} />
                    <span>Reset</span>
                </button>
            </div>
        </div>
    );
}

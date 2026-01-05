'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { updateProfileBatch } from '@/app/actions';
import type { ProfileCookie } from '@/shared/profileCookie';
import { toConditionLabel } from '@/shared/conditions-normalize';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

type TrialsSentenceHeaderProps = {
    condition?: string;
    zip?: string;
    profile: ProfileCookie | null;
};

const DISTANCE_OPTIONS = [10, 25, 50, 100];

/**
 * Inline control styling - subtle underline on hover, no hard borders
 * Variables are bold/dark, interactive feedback is minimal
 */
const inlineControlClass = cn(
    'inline-flex items-baseline gap-0.5',
    'text-slate-900 font-semibold',
    'hover:text-[#F26A57]',
    'border-b border-transparent hover:border-dotted hover:border-slate-300',
    'cursor-pointer transition-all duration-150'
);

export default function TrialsSentenceHeader({
    condition,
    zip,
    profile,
}: TrialsSentenceHeaderProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Popover open states
    const [conditionOpen, setConditionOpen] = useState(false);

    // Local state for inputs
    // Only use profile cookie fallback if prefill=1 is explicitly set
    const useCookieFallback = searchParams.get('prefill') === '1';
    const [age, setAge] = useState<string>(searchParams.get('age') || (useCookieFallback ? profile?.age?.toString() : '') || '');
    const [sex, setSex] = useState<string>(searchParams.get('sex') || (useCookieFallback ? profile?.sex : '') || '');
    const [distance, setDistance] = useState<number>(
        parseInt(searchParams.get('radius') || profile?.radius?.toString() || '50')
    );
    const [zipInput, setZipInput] = useState<string>(zip || '');
    const [conditionSearch, setConditionSearch] = useState<string>('');
    const [allConditions, setAllConditions] = useState<{ slug: string; label: string }[]>([]);
    const [isLoadingConditions, setIsLoadingConditions] = useState(false);

    // Derived state
    const isNationwide = !zip || zip.trim() === '';
    const displayCondition = condition && condition !== 'all'
        ? toConditionLabel(condition)
        : 'any condition';
    const displaySex = sex === 'male' ? 'male' : sex === 'female' ? 'female' : 'any sex';
    const displayAge = age && parseInt(age) > 0 ? `${age}` : 'any';

    // Fetch conditions on mount
    useEffect(() => {
        async function fetchConditions() {
            setIsLoadingConditions(true);
            try {
                const response = await fetch('/api/conditions/suggestions?query=');
                if (response.ok) {
                    const data = await response.json();
                    setAllConditions(data);
                }
            } catch (error) {
                console.error('Failed to fetch conditions:', error);
            } finally {
                setIsLoadingConditions(false);
            }
        }
        fetchConditions();
    }, []);

    const filteredConditions = conditionSearch
        ? allConditions.filter((c) =>
            c.label.toLowerCase().includes(conditionSearch.toLowerCase())
        )
        : allConditions;

    // Handlers
    const handleConditionChange = (conditionSlug: string) => {
        setConditionOpen(false);
        const params = new URLSearchParams(searchParams.toString());
        if (conditionSlug === 'all') {
            params.delete('condition');
        } else {
            params.set('condition', conditionSlug);
        }
        params.delete('page');
        // Use window.location for reliable navigation
        window.location.href = `/trials?${params.toString()}`;
    };

    const handleZipUpdate = () => {
        const params = new URLSearchParams(searchParams.toString());
        if (zipInput) {
            params.set('zip', zipInput);
        } else {
            params.delete('zip');
            params.set('sort', 'recruiting');
        }
        params.delete('page');
        window.location.href = `/trials?${params.toString()}`;
    };

    const handleDistanceUpdate = (values: number[]) => {
        const newDistance = values[0];
        setDistance(newDistance);
        updateProfileBatch({ radius: newDistance }).catch(console.error);

        const params = new URLSearchParams(searchParams.toString());
        params.set('radius', newDistance.toString());
        params.delete('page');
        router.replace(`/trials?${params.toString()}`, { scroll: false });
    };

    const handleAgeUpdate = () => {
        const params = new URLSearchParams(searchParams.toString());
        if (age) {
            const ageNum = parseInt(age);
            if (!isNaN(ageNum) && ageNum >= 0 && ageNum <= 120) {
                params.set('age', age);
                updateProfileBatch({ age: ageNum }).catch(console.error);
            }
        } else {
            params.delete('age');
            updateProfileBatch({ age: undefined }).catch(console.error);
        }
        params.delete('page');
        window.location.href = `/trials?${params.toString()}`;
    };

    const handleSexUpdate = (value: string) => {
        setSex(value);
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
            params.set('sex', value);
        } else {
            params.delete('sex');
        }
        params.delete('page');
        updateProfileBatch({ sex: value as 'male' | 'female' | 'other' }).catch(console.error);
        window.location.href = `/trials?${params.toString()}`;
    };

    const distanceToIndex = (dist: number) => {
        const index = DISTANCE_OPTIONS.indexOf(dist);
        return index >= 0 ? index : 2; // Default to 50 (index 2)
    };

    return (
        <div className="text-lg md:text-xl leading-relaxed font-medium">
            <span className="text-slate-400">Trials for </span>

            {/* Condition Control */}
            <Popover open={conditionOpen} onOpenChange={setConditionOpen}>
                <PopoverTrigger asChild>
                    <button className={inlineControlClass}>
                        <span>{displayCondition}</span>
                        <ChevronDown size={12} className="opacity-50" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 bg-white shadow-xl p-0 overflow-hidden rounded-none">
                    <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                            Target Condition
                        </h4>
                    </div>
                    <div className="p-2 space-y-2">
                        <Input
                            type="text"
                            placeholder="Search conditions..."
                            value={conditionSearch}
                            onChange={(e) => setConditionSearch(e.target.value)}
                            className="h-9 text-sm rounded-none"
                        />
                        <div className="max-h-64 overflow-y-auto">
                            {isLoadingConditions ? (
                                <div className="flex flex-col items-center py-8 gap-2">
                                    <div className="w-4 h-4 border-2 border-[#F26A57] border-t-transparent rounded-full animate-spin" />
                                    <p className="text-[11px] font-medium text-slate-400">Loading...</p>
                                </div>
                            ) : filteredConditions.length > 0 ? (
                                <div className="grid grid-cols-1 gap-0.5">
                                    <button
                                        onClick={() => handleConditionChange('all')}
                                        className={cn(
                                            'w-full text-left px-3 py-2 text-sm rounded-none transition-all',
                                            !condition || condition === 'all'
                                                ? 'bg-[#F26A57]/5 text-[#F26A57] font-semibold'
                                                : 'hover:bg-slate-50 text-slate-700'
                                        )}
                                    >
                                        Any condition
                                    </button>
                                    {filteredConditions.slice(0, 15).map((cond) => (
                                        <button
                                            key={cond.slug}
                                            onClick={() => handleConditionChange(cond.slug)}
                                            className={cn(
                                                'w-full text-left px-3 py-2 text-sm rounded-none transition-all',
                                                condition === cond.slug
                                                    ? 'bg-[#F26A57]/5 text-[#F26A57] font-semibold'
                                                    : 'hover:bg-slate-50 text-slate-700'
                                            )}
                                        >
                                            {cond.label}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500 text-center py-8">No results</p>
                            )}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>

            {/* Location - ZIP or Nationwide */}
            {isNationwide ? (
                <>
                    <span> </span>
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className={inlineControlClass}>
                                <span>nationwide</span>
                                <ChevronDown size={12} className="opacity-50" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 bg-white shadow-xl rounded-none p-4">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <h4 className="font-semibold text-sm">Add Location</h4>
                                    <p className="text-xs text-slate-500">
                                        Enter your zip code to find trials near you.
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Zip Code"
                                        className="h-9"
                                        value={zipInput}
                                        onChange={(e) => setZipInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleZipUpdate()}
                                    />
                                    <Button
                                        size="sm"
                                        onClick={handleZipUpdate}
                                        className="bg-[#F26A57] hover:bg-[#E05A47]"
                                    >
                                        Apply
                                    </Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </>
            ) : (
                <>
                    <span className="text-slate-400"> near </span>
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className={inlineControlClass}>
                                <span>{zip}</span>
                                <ChevronDown size={12} className="opacity-50" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 bg-white shadow-xl rounded-none p-4">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <h4 className="font-semibold text-sm">Update Location</h4>
                                    <p className="text-xs text-slate-500">
                                        Enter your zip code to find trials near you.
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Zip Code"
                                        className="h-9"
                                        value={zipInput}
                                        onChange={(e) => setZipInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleZipUpdate()}
                                    />
                                    <Button
                                        size="sm"
                                        onClick={handleZipUpdate}
                                        className="bg-[#F26A57] hover:bg-[#E05A47]"
                                    >
                                        Apply
                                    </Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Radius - Only shown when NOT nationwide */}
                    <span className="text-slate-400"> within </span>
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className={inlineControlClass}>
                                <span>{distance} mi</span>
                                <ChevronDown size={12} className="opacity-50" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 bg-white shadow-xl rounded-none p-4">
                            <div className="space-y-5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                        Search Radius
                                    </Label>
                                    <span className="text-sm font-bold text-[#F26A57]">{distance} mi</span>
                                </div>
                                <Slider
                                    value={[distanceToIndex(distance)]}
                                    onValueChange={(values) => {
                                        const newDistance = DISTANCE_OPTIONS[values[0]];
                                        handleDistanceUpdate([newDistance]);
                                    }}
                                    min={0}
                                    max={DISTANCE_OPTIONS.length - 1}
                                    step={1}
                                    className="w-full"
                                />
                                <div className="flex justify-between text-[10px] font-bold text-slate-400">
                                    {DISTANCE_OPTIONS.map((dist) => (
                                        <span key={dist}>{dist}</span>
                                    ))}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </>
            )}

            {/* Sex Control */}
            <span className="text-slate-400"> for </span>
            <Popover>
                <PopoverTrigger asChild>
                    <button className={inlineControlClass}>
                        <span>{displaySex}</span>
                        <ChevronDown size={12} className="opacity-50" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 bg-white shadow-xl rounded-none p-4">
                    <div className="space-y-3">
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Biological Sex
                        </Label>
                        <RadioGroup value={sex} onValueChange={handleSexUpdate} className="flex flex-col gap-2">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="" id="sex-any" className="text-[#F26A57] border-[#F26A57]" />
                                <Label htmlFor="sex-any" className="text-sm font-medium cursor-pointer">
                                    Any sex
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="male" id="sex-male" className="text-[#F26A57] border-[#F26A57]" />
                                <Label htmlFor="sex-male" className="text-sm font-medium cursor-pointer">
                                    Male
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="female" id="sex-female" className="text-[#F26A57] border-[#F26A57]" />
                                <Label htmlFor="sex-female" className="text-sm font-medium cursor-pointer">
                                    Female
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>
                </PopoverContent>
            </Popover>

            {/* Age Control */}
            <span className="text-slate-400"> age </span>
            <Popover>
                <PopoverTrigger asChild>
                    <button className={inlineControlClass}>
                        <span>{displayAge}</span>
                        <ChevronDown size={12} className="opacity-50" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 bg-white shadow-xl rounded-none p-4">
                    <div className="space-y-3">
                        <Label htmlFor="age-input" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Age
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                id="age-input"
                                type="number"
                                value={age}
                                onChange={(e) => setAge(e.target.value)}
                                placeholder="Enter age"
                                className="h-9 text-sm rounded-none"
                                min={0}
                                max={120}
                            />
                            <Button size="sm" onClick={handleAgeUpdate} variant="secondary">
                                Set
                            </Button>
                        </div>
                        <p className="text-[11px] text-slate-400">
                            Leave empty to see trials for all ages.
                        </p>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}

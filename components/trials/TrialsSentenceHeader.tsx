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
const ZIP_RE = /^\d{5}$/;

function normalizeSexSelection(value: string | null | undefined): "" | "male" | "female" {
    if (value === "male" || value === "female") return value;
    return "";
}

/**
 * Inline control styling - clean hover without dotted underlines (de-vibe-coded)
 */
const inlineControlClass = cn(
    'inline-flex items-baseline gap-0.5',
    'text-foreground font-bold',
    'hover:text-primary',
    'cursor-pointer transition-colors duration-150'
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
    const [sex, setSex] = useState<"" | "male" | "female">(
        normalizeSexSelection(searchParams.get('sex') || (useCookieFallback ? profile?.sex : '') || '')
    );
    const [distance, setDistance] = useState<number>(
        parseInt(searchParams.get('radius') || profile?.radius?.toString() || '50')
    );
    const [zipInput, setZipInput] = useState<string>(zip || '');
    const [conditionSearch, setConditionSearch] = useState<string>('');
    const [allConditions, setAllConditions] = useState<{ slug: string; label: string }[]>([]);
    const [isLoadingConditions, setIsLoadingConditions] = useState(false);
    const [zipError, setZipError] = useState<string | null>(null);

    // Derived state
    const isNationwide = !zip || zip.trim() === '';
    const displayCondition = condition && condition !== 'all'
        ? toConditionLabel(condition)
        : 'all conditions';
    const displaySex = sex === 'male' ? 'men' : sex === 'female' ? 'women' : null;
    const displayAge = age && parseInt(age) > 0 ? `age ${age}` : null;

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

    const navigateWithParams = (params: URLSearchParams) => {
        router.push(`/trials?${params.toString()}`, { scroll: false });
    };

    // Handlers
    const handleConditionChange = (conditionSlug: string) => {
        setConditionOpen(false);
        const params = new URLSearchParams(searchParams.toString());
        if (conditionSlug === 'all') {
            params.delete('condition');
            updateProfileBatch({ conditions: [] }).catch(console.error);
        } else {
            params.set('condition', conditionSlug);
            updateProfileBatch({ conditions: [conditionSlug] }).catch(console.error);
        }
        params.delete('page');
        navigateWithParams(params);
    };

    const handleZipUpdate = () => {
        const normalizedZip = zipInput.trim();
        const params = new URLSearchParams(searchParams.toString());
        if (normalizedZip) {
            if (!ZIP_RE.test(normalizedZip)) {
                setZipError('Enter a valid 5-digit ZIP code.');
                return;
            }
            params.set('zip', normalizedZip);
            setZipError(null);
            updateProfileBatch({ zip: normalizedZip }).catch(console.error);
        } else {
            setZipError(null);
            params.delete('zip');
            params.set('sort', 'recruiting');
            updateProfileBatch({ zip: undefined }).catch(console.error);
        }
        params.delete('page');
        navigateWithParams(params);
    };

    const handleNationwideUpdate = () => {
        setZipInput('');
        setZipError(null);
        const params = new URLSearchParams(searchParams.toString());
        params.delete('zip');
        params.delete('radius');
        params.set('sort', 'recruiting');
        params.delete('page');
        updateProfileBatch({ zip: undefined }).catch(console.error);
        navigateWithParams(params);
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
        navigateWithParams(params);
    };

    const handleSexUpdate = (value: string) => {
        const normalized = normalizeSexSelection(value);
        setSex(normalized);
        const params = new URLSearchParams(searchParams.toString());
        if (normalized) {
            params.set('sex', normalized);
        } else {
            params.delete('sex');
        }
        params.delete('page');
        updateProfileBatch({ sex: normalized || null }).catch(console.error);
        navigateWithParams(params);
    };

    const distanceToIndex = (dist: number) => {
        const index = DISTANCE_OPTIONS.indexOf(dist);
        return index >= 0 ? index : 2; // Default to 50 (index 2)
    };

    return (
        <div id="trials-filters" className="inline-block rounded-2xl border border-border/50 bg-card px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-base font-medium leading-relaxed sm:text-lg md:text-xl">
                <span className="text-muted-foreground">Showing</span>

                {/* Condition Control */}
                <Popover open={conditionOpen} onOpenChange={setConditionOpen}>
                    <PopoverTrigger asChild>
                        <button
                            className={inlineControlClass}
                            tabIndex={1}
                        >
                            <span>{displayCondition}</span>
                            <ChevronDown size={12} className="opacity-50" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 shadow-lg border border-border/60 p-0 overflow-hidden rounded-xl" style={{ backgroundColor: '#FFFFFF' }}>
                        <div className="p-3 border-b border-border/40 bg-secondary/50">
                            <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                                Target Condition
                            </h4>
                        </div>
                        <div className="p-2 space-y-2">
                            <Input
                                type="text"
                                placeholder="Search conditions..."
                                value={conditionSearch}
                                onChange={(e) => setConditionSearch(e.target.value)}
                                className="h-9 text-sm rounded-lg"
                            />
                            <div className="max-h-64 overflow-y-auto">
                                {isLoadingConditions ? (
                                    <div className="flex flex-col items-center py-8 gap-2">
                                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                        <p className="text-xs font-medium text-muted-foreground">Loading...</p>
                                    </div>
                                ) : filteredConditions.length > 0 ? (
                                    <div className="flex flex-col gap-0.5">
                                        <button
                                            onClick={() => handleConditionChange('all')}
                                            className={cn(
                                                'w-full text-left px-3 py-2 text-sm rounded-lg transition-colors',
                                                !condition || condition === 'all'
                                                    ? 'bg-primary/10 text-primary font-semibold'
                                                    : 'hover:bg-secondary/50 text-foreground'
                                            )}
                                        >
                                            Any condition
                                        </button>
                                        {filteredConditions.slice(0, 15).map((cond) => (
                                            <button
                                                key={cond.slug}
                                                onClick={() => handleConditionChange(cond.slug)}
                                                className={cn(
                                                    'w-full text-left px-3 py-2 text-sm rounded-lg transition-colors',
                                                    condition === cond.slug
                                                        ? 'bg-primary/10 text-primary font-semibold'
                                                        : 'hover:bg-secondary/50 text-foreground'
                                                )}
                                            >
                                                {cond.label}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-8">No results</p>
                                )}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Location - ZIP or Nationwide */}
                <span className="text-muted-foreground">trials</span>

                {isNationwide ? (
                    <>
                        <Popover>
                            <PopoverTrigger asChild>
                                <button className={inlineControlClass} tabIndex={2}>
                                    <span>nationwide</span>
                                    <ChevronDown size={12} className="opacity-50" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 shadow-lg border border-border/60 rounded-xl p-4" style={{ backgroundColor: '#FFFFFF' }}>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <h4 className="font-semibold text-sm text-foreground">Add Location</h4>
                                        <p className="text-xs text-muted-foreground">
                                            Enter your zip code to find trials near you.
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Zip Code"
                                            className="h-9"
                                            value={zipInput}
                                            inputMode="numeric"
                                            maxLength={5}
                                            onChange={(e) => {
                                                setZipInput(e.target.value.replace(/\D/g, '').slice(0, 5));
                                                if (zipError) {
                                                    setZipError(null);
                                                }
                                            }}
                                            onKeyDown={(e) => e.key === 'Enter' && handleZipUpdate()}
                                        />
                                        <Button
                                            size="sm"
                                            onClick={handleZipUpdate}
                                            variant="brand"
                                        >
                                            Apply
                                        </Button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleNationwideUpdate}
                                        className="text-xs font-medium text-primary underline-offset-4 transition hover:text-primary/80 hover:underline"
                                    >
                                        Search nationwide instead
                                    </button>
                                    {zipError && (
                                        <p className="text-xs text-red-600">{zipError}</p>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </>
                ) : (
                    <>
                        <span className="text-muted-foreground">near</span>
                        <Popover>
                            <PopoverTrigger asChild>
                                <button className={inlineControlClass} tabIndex={2}>
                                    <span>{zip}</span>
                                    <ChevronDown size={12} className="opacity-50" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 shadow-lg border border-border/60 rounded-xl p-4" style={{ backgroundColor: '#FFFFFF' }}>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <h4 className="font-semibold text-sm text-foreground">Update Location</h4>
                                        <p className="text-xs text-muted-foreground">
                                            Enter your zip code to find trials near you.
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Zip Code"
                                            className="h-9"
                                            value={zipInput}
                                            inputMode="numeric"
                                            maxLength={5}
                                            onChange={(e) => {
                                                setZipInput(e.target.value.replace(/\D/g, '').slice(0, 5));
                                                if (zipError) {
                                                    setZipError(null);
                                                }
                                            }}
                                            onKeyDown={(e) => e.key === 'Enter' && handleZipUpdate()}
                                        />
                                        <Button
                                            size="sm"
                                            onClick={handleZipUpdate}
                                            variant="brand"
                                        >
                                            Apply
                                        </Button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleNationwideUpdate}
                                        className="text-xs font-medium text-primary underline-offset-4 transition hover:text-primary/80 hover:underline"
                                    >
                                        Search nationwide instead
                                    </button>
                                    {zipError && (
                                        <p className="text-xs text-red-600">{zipError}</p>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>

                        {/* Radius - Only shown when NOT nationwide */}
                        <span className="text-muted-foreground">within</span>
                        <Popover>
                            <PopoverTrigger asChild>
                                <button className={inlineControlClass} tabIndex={3}>
                                    <span>{distance} mi</span>
                                    <ChevronDown size={12} className="opacity-50" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 shadow-lg border border-border/60 rounded-xl p-4" style={{ backgroundColor: '#FFFFFF' }}>
                                <div className="space-y-5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            Search Radius
                                        </Label>
                                        <span className="text-sm font-bold text-primary tabular-nums">{distance} mi</span>
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
                                    <div className="flex justify-between text-[10px] font-bold text-muted-foreground tabular-nums">
                                        {DISTANCE_OPTIONS.map((dist) => (
                                            <span key={dist}>{dist}</span>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleNationwideUpdate}
                                        className="text-xs font-medium text-primary underline-offset-4 transition hover:text-primary/80 hover:underline"
                                    >
                                        Search nationwide instead
                                    </button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </>
                )}

                {(displaySex || displayAge) && (
                    <>
                        {displaySex && (
                            <>
                                <span className="text-muted-foreground">for</span>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button className={inlineControlClass} tabIndex={4}>
                                            <span>{displaySex}</span>
                                            <ChevronDown size={12} className="opacity-50" />
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 shadow-lg border border-border/60 rounded-xl p-4" style={{ backgroundColor: '#FFFFFF' }}>
                                        <div className="space-y-3">
                                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                Biological Sex
                                            </Label>
                                            <RadioGroup value={sex} onValueChange={handleSexUpdate} className="flex flex-col gap-2">
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="" id="sex-any" className="text-primary border-primary" />
                                                    <Label htmlFor="sex-any" className="text-sm font-medium cursor-pointer text-foreground">
                                                        Any sex
                                                    </Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="male" id="sex-male" className="text-primary border-primary" />
                                                    <Label htmlFor="sex-male" className="text-sm font-medium cursor-pointer text-foreground">
                                                        Male
                                                    </Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="female" id="sex-female" className="text-primary border-primary" />
                                                    <Label htmlFor="sex-female" className="text-sm font-medium cursor-pointer text-foreground">
                                                        Female
                                                    </Label>
                                                </div>
                                            </RadioGroup>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </>
                        )}

                        {displayAge && (
                            <>
                                <span className="text-muted-foreground">with</span>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button className={inlineControlClass} tabIndex={5}>
                                            <span>{displayAge}</span>
                                            <ChevronDown size={12} className="opacity-50" />
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 shadow-lg border border-border/60 rounded-xl p-4" style={{ backgroundColor: '#FFFFFF' }}>
                                        <div className="space-y-3">
                                            <Label htmlFor="age-input" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                Age
                                            </Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    id="age-input"
                                                    type="number"
                                                    value={age}
                                                    onChange={(e) => setAge(e.target.value)}
                                                    placeholder="Enter age"
                                                    className="h-9 text-sm rounded-lg"
                                                    min={0}
                                                    max={120}
                                                />
                                                <Button size="sm" onClick={handleAgeUpdate} variant="secondary">
                                                    Set
                                                </Button>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Leave empty to see trials for all ages.
                                            </p>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

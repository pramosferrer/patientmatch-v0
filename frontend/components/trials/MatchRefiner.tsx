'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { updateProfileBatch } from '@/app/actions';
import type { ProfileCookie } from '@/shared/profileCookie';

type MatchRefinerProps = {
    initialProfile: ProfileCookie | null;
};

const DISTANCE_OPTIONS = [10, 25, 50, 100];

export default function MatchRefiner({ initialProfile }: MatchRefinerProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [age, setAge] = useState<string>(initialProfile?.age?.toString() || '');
    const [sex, setSex] = useState<string>(initialProfile?.sex || '');
    const [distance, setDistance] = useState<number>(
        initialProfile?.radius || parseInt(searchParams.get('radius') || '50')
    );
    const [forSelf, setForSelf] = useState<boolean>(true); // Default to "for yourself"

    // Debounced update for age
    useEffect(() => {
        const timer = setTimeout(() => {
            if (age) {
                const ageNum = parseInt(age);
                if (!isNaN(ageNum) && ageNum >= 0 && ageNum <= 120) {
                    updateProfileBatch({ age: ageNum }).catch(console.error);
                }
            } else {
                // Clear age if empty
                updateProfileBatch({ age: undefined }).catch(console.error);
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [age]);

    // Update sex immediately
    const handleSexChange = (value: string) => {
        setSex(value);
        updateProfileBatch({
            sex: value as 'male' | 'female' | 'other'
        }).catch(console.error);
    };

    // Update distance and navigate
    const handleDistanceChange = (values: number[]) => {
        const newDistance = values[0];
        setDistance(newDistance);

        // Update profile cookie
        updateProfileBatch({ radius: newDistance }).catch(console.error);

        // Update URL to trigger re-fetch
        const params = new URLSearchParams(searchParams.toString());
        params.set('radius', newDistance.toString());
        params.delete('page'); // Reset to page 1
        router.replace(`/trials?${params.toString()}`, { scroll: false });
    };

    // Handle self/other toggle
    const handleForSelfChange = (checked: boolean) => {
        setForSelf(checked);
        // Store in profile for future use (not currently used in filtering)
        // We can add a custom field or use this for analytics
    };

    // Map distance to slider index
    const distanceToIndex = (dist: number) => {
        const index = DISTANCE_OPTIONS.indexOf(dist);
        return index >= 0 ? index : 1; // Default to 25 miles (index 1)
    };

    const sliderValue = distanceToIndex(distance);

    return (
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-6 shadow-sm backdrop-blur-sm">
            <div className="mb-5">
                <h3 className="text-base font-semibold text-slate-900">
                    Better matches? Add a few details.
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                    Help us find trials that are right for you
                </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
                {/* Age Input */}
                <div className="space-y-2">
                    <Label htmlFor="age" className="text-sm font-medium text-slate-700">
                        How old are you?
                    </Label>
                    <Input
                        id="age"
                        type="number"
                        min="0"
                        max="120"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="Enter age"
                        className="h-10 bg-white"
                    />
                </div>

                {/* Sex Selection */}
                <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">
                        What is your sex?
                    </Label>
                    <RadioGroup value={sex} onValueChange={handleSexChange} className="flex gap-4">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="male" id="male" />
                            <Label htmlFor="male" className="font-normal cursor-pointer">
                                Male
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="female" id="female" />
                            <Label htmlFor="female" className="font-normal cursor-pointer">
                                Female
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="other" id="other" />
                            <Label htmlFor="other" className="font-normal cursor-pointer">
                                Other
                            </Label>
                        </div>
                    </RadioGroup>
                </div>

                {/* Distance Slider */}
                <div className="space-y-3 sm:col-span-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium text-slate-700">
                            How far are you willing to travel?
                        </Label>
                        <span className="text-sm font-semibold text-rose-600">
                            {distance} miles
                        </span>
                    </div>
                    <Slider
                        value={[sliderValue]}
                        onValueChange={(values) => {
                            const newDistance = DISTANCE_OPTIONS[values[0]];
                            handleDistanceChange([newDistance]);
                        }}
                        min={0}
                        max={DISTANCE_OPTIONS.length - 1}
                        step={1}
                        className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-500">
                        {DISTANCE_OPTIONS.map((dist) => (
                            <span key={dist}>{dist}</span>
                        ))}
                    </div>
                </div>

                {/* Self/Other Toggle */}
                <div className="flex items-center justify-between sm:col-span-2 rounded-lg bg-slate-50 p-3">
                    <Label htmlFor="for-self" className="text-sm font-medium text-slate-700 cursor-pointer">
                        Are you looking for yourself or someone else?
                    </Label>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-600">
                            {forSelf ? 'For myself' : 'For someone else'}
                        </span>
                        <Switch
                            id="for-self"
                            checked={forSelf}
                            onCheckedChange={handleForSelfChange}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

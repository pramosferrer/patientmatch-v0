'use client';

import { useState } from 'react';
import { ProfileCookie } from '@/shared/profileCookie';
import { updateProfileField } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, X } from 'lucide-react';
import { toConditionSlug, toConditionLabel, VALID_SLUGS } from '@/shared/conditions-normalize';

import { cn } from '@/lib/utils';;

export function EnrichmentBanner({ profile, compact = false }: { profile: ProfileCookie | null; compact?: boolean }) {
    const [dismissed, setDismissed] = useState(false);
    const [loading, setLoading] = useState(false);

    if (dismissed) return null;

    const p = profile || {};

    // Determine priority: Age -> Sex -> Diagnosis (Conditions) -> Radius
    let missingField: 'age' | 'sex' | 'conditions' | 'radius' | null = null;

    if (p.age === undefined) missingField = 'age';
    else if (!p.sex) missingField = 'sex';
    else if (!p.conditions || p.conditions.length === 0) missingField = 'conditions';
    else if (!p.radius) missingField = 'radius';

    if (!missingField) {
        // Profile complete
        // Optional: Check confidence score here, but for now returned nothing if all fields present
        return null;
        // Or show a "Profile Complete" badge momentarily?
        // User request: "reappear until profile is complete enough."
        // If complete, we hide.
    }

    // Calculate generic confidence
    let filledCount = 0;
    if (p.age !== undefined) filledCount++;
    if (p.sex) filledCount++;
    if (p.conditions?.length) filledCount++;
    if (p.radius) filledCount++;
    // Total 4 priority fields.
    // Other fields like zip, pregnancy might exist but we focus on these 4.
    const confidencePercent = Math.round((filledCount / 4) * 100);
    const confidenceLabel = confidencePercent < 50 ? 'Low' : confidencePercent < 100 ? 'Medium' : 'High';


    const handleSubmit = async (value: any) => {
        setLoading(true);
        try {
            await updateProfileField(missingField!, value);
        } catch (e) {
            console.error("Failed to update profile", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card
            className={cn(
                "mb-6 border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10 relative",
                compact ? "p-3 py-2 mb-4" : "p-4"
            )}
        >
            <div className={cn("flex items-center", compact ? "justify-between gap-4" : "justify-between items-start")}>
                <div className={cn("space-y-1", compact && "flex items-center gap-3 space-y-0")}>
                    <h3 className={cn("font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2", compact && "text-sm whitespace-nowrap")}>
                        {compact ? "Improve matches" : "Improve your matches"}
                        <span className={cn(
                            "font-normal px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300",
                            compact ? "text-[10px] px-1.5" : "text-xs"
                        )}>
                            {compact ? `Strength: ${confidenceLabel}` : `Profile Strength: ${confidenceLabel}`}
                        </span>
                    </h3>
                    {!compact && (
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                            Answer one more question to find better trials.
                        </p>
                    )}
                </div>

                {compact && (
                    <div className="flex-1 max-w-xl flex justify-center">
                        {/* Render input inline if compact, or simplified */}
                        {missingField === 'age' && <AgeInput onSubmit={handleSubmit} loading={loading} compact />}
                        {missingField === 'sex' && <SexInput onSubmit={handleSubmit} loading={loading} compact />}
                        {missingField === 'conditions' && <ConditionInput onSubmit={handleSubmit} loading={loading} compact />}
                        {missingField === 'radius' && <RadiusInput onSubmit={handleSubmit} loading={loading} compact />}
                    </div>
                )}

                <div className={cn("flex items-center", !compact && "-mr-2 -mt-2")}>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn("text-blue-400 hover:text-blue-600", compact ? "h-6 w-6" : "h-6 w-6")}
                        onClick={() => setDismissed(true)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {!compact && (
                <div className="mt-4 flex items-center gap-3">
                    {missingField === 'age' && (
                        <AgeInput onSubmit={handleSubmit} loading={loading} />
                    )}
                    {missingField === 'sex' && (
                        <SexInput onSubmit={handleSubmit} loading={loading} />
                    )}
                    {missingField === 'conditions' && (
                        <ConditionInput onSubmit={handleSubmit} loading={loading} />
                    )}
                    {missingField === 'radius' && (
                        <RadiusInput onSubmit={handleSubmit} loading={loading} />
                    )}
                </div>
            )}
        </Card>
    );
}

function AgeInput({ onSubmit, loading, compact }: { onSubmit: (val: number) => void, loading: boolean, compact?: boolean }) {
    const [val, setVal] = useState('');
    return (
        <div className={cn("flex gap-2 items-center w-full", compact ? "max-w-xs" : "max-w-sm")}>
            <span className={cn("font-medium whitespace-nowrap", compact ? "text-xs" : "text-sm")}>What is your age?</span>
            <Input
                type="number"
                placeholder="Ex: 45"
                value={val}
                onChange={e => setVal(e.target.value)}
                className={cn("w-20", compact && "h-8 text-xs")}
                min={0}
                max={120}
            />
            <Button
                onClick={() => onSubmit(parseInt(val, 10))}
                disabled={!val || loading}
                size={compact ? "sm" : "sm"}
                className={cn(compact && "h-8 px-3")}
            >
                {loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Save
            </Button>
        </div>
    )
}

function SexInput({ onSubmit, loading, compact }: { onSubmit: (val: string) => void, loading: boolean, compact?: boolean }) {
    return (
        <div className={cn("flex gap-2 items-center", compact ? "text-xs" : "text-sm")}>
            <span className="font-medium">Sex at birth:</span>
            <Button variant="outline" size={compact ? "sm" : "sm"} onClick={() => onSubmit('male')} disabled={loading} className={cn(compact && "h-8 px-3")}>Male</Button>
            <Button variant="outline" size={compact ? "sm" : "sm"} onClick={() => onSubmit('female')} disabled={loading} className={cn(compact && "h-8 px-3")}>Female</Button>
        </div>
    )
}

function RadiusInput({ onSubmit, loading, compact }: { onSubmit: (val: number) => void, loading: boolean, compact?: boolean }) {
    const [val, setVal] = useState('50');
    return (
        <div className={cn("flex gap-2 items-center w-full", compact ? "max-w-xs" : "max-w-sm")}>
            <span className={cn("font-medium whitespace-nowrap", compact ? "text-xs" : "text-sm")}>travel radius (miles)?</span>
            <Select value={val} onValueChange={setVal} disabled={loading}>
                <SelectTrigger className={cn("w-32", compact && "h-8 text-xs")}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="10">10 miles</SelectItem>
                    <SelectItem value="25">25 miles</SelectItem>
                    <SelectItem value="50">50 miles</SelectItem>
                    <SelectItem value="100">100 miles</SelectItem>
                    <SelectItem value="500">500 miles</SelectItem>
                    <SelectItem value="3000">Nationwide</SelectItem>
                </SelectContent>
            </Select>
            <Button onClick={() => onSubmit(parseInt(val, 10))} disabled={loading} size={compact ? "sm" : "sm"} className={cn(compact && "h-8 px-3")}>
                {loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Save
            </Button>
        </div>
    )
}

function ConditionInput({ onSubmit, loading, compact }: { onSubmit: (val: string[]) => void, loading: boolean, compact?: boolean }) {
    const [val, setVal] = useState("");
    const popular = Array.from(VALID_SLUGS).map(slug => ({ slug, label: toConditionLabel(slug) }));

    return (
        <div className={cn("flex gap-2 items-center w-full", compact ? "max-w-sm" : "max-w-md")}>
            <span className={cn("font-medium whitespace-nowrap", compact ? "text-xs" : "text-sm")}>Primary Diagnosis:</span>
            <Select value={val} onValueChange={setVal} disabled={loading}>
                <SelectTrigger className={cn("w-48", compact && "h-8 text-xs")}>
                    <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                    {popular.map(c => (
                        <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Button onClick={() => onSubmit([val])} disabled={!val || loading} size={compact ? "sm" : "sm"} className={cn(compact && "h-8 px-3")}>
                {loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Save
            </Button>
        </div>
    )
}

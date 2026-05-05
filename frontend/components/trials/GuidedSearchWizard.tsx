'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { updateProfileBatch } from '@/app/actions';
import { cn } from '@/lib/utils';
import { Sparkles, ChevronRight, ChevronLeft, Check, MapPin, User, Stethoscope } from 'lucide-react';

type GuidedSearchWizardProps = {
    triggerClassName?: string;
};

const STEPS = [
    { id: 1, title: 'Condition', icon: Stethoscope, description: 'What condition are you researching?' },
    { id: 2, title: 'Location', icon: MapPin, description: 'Where are you located?' },
    { id: 3, title: 'About You', icon: User, description: 'Tell us a bit about yourself' },
];

export default function GuidedSearchWizard({ triggerClassName }: GuidedSearchWizardProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(1);

    // Form state
    const [condition, setCondition] = useState('');
    const [conditionSearch, setConditionSearch] = useState('');
    const [zip, setZip] = useState('');
    const [age, setAge] = useState('');
    const [sex, setSex] = useState('');

    // Popular conditions for quick selection
    const popularConditions = [
        { slug: 'breast-cancer', label: 'Breast Cancer' },
        { slug: 'lung-cancer', label: 'Lung Cancer' },
        { slug: 'diabetes', label: 'Diabetes' },
        { slug: 'copd', label: 'COPD' },
        { slug: 'alzheimers-disease', label: "Alzheimer's Disease" },
        { slug: 'depression', label: 'Depression' },
    ];

    const handleNext = async () => {
        if (step < 3) {
            setStep(step + 1);
        } else {
            // Build URL and navigate
            const params = new URLSearchParams();
            if (condition) params.set('condition', condition);
            if (zip) params.set('zip', zip);
            if (age) params.set('age', age);
            if (sex) params.set('sex', sex);

            const parsedAge = Number.parseInt(age, 10);
            const normalizedZip = zip.replace(/\D/g, '').slice(0, 5);
            try {
                await updateProfileBatch({
                    age: Number.isFinite(parsedAge) && parsedAge >= 0 && parsedAge <= 120 ? parsedAge : undefined,
                    sex: sex === 'male' || sex === 'female' ? sex : null,
                    zip: normalizedZip.length === 5 ? normalizedZip : undefined,
                    conditions: condition ? [condition] : [],
                });
            } catch (error) {
                console.error('Failed to persist guided search profile fields', error);
            }

            setOpen(false);
            router.push(`/trials?${params.toString()}`);
        }
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const canProceed = () => {
        if (step === 1) return condition !== '';
        return true; // Steps 2 and 3 are optional
    };

    const resetWizard = () => {
        setStep(1);
        setCondition('');
        setConditionSearch('');
        setZip('');
        setAge('');
        setSex('');
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (!isOpen) resetWizard();
        }}>
            <DialogTrigger asChild>
                <button className={cn(
                    "inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors",
                    triggerClassName
                )}>
                    <Sparkles size={14} />
                    <span>Guided search</span>
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold">
                        Find Your Trial Match
                    </DialogTitle>
                </DialogHeader>

                {/* Step indicators */}
                <div className="flex items-center justify-between mt-2 mb-6">
                    {STEPS.map((s, idx) => (
                        <div key={s.id} className="flex items-center">
                            <div className={cn(
                                "flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors",
                                step === s.id && "bg-primary text-primary-foreground",
                                step > s.id && "bg-primary/20 text-primary",
                                step < s.id && "bg-secondary text-muted-foreground"
                            )}>
                                {step > s.id ? <Check size={14} /> : s.id}
                            </div>
                            {idx < STEPS.length - 1 && (
                                <div className={cn(
                                    "w-16 h-0.5 mx-2",
                                    step > s.id ? "bg-primary/40" : "bg-border"
                                )} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Step content */}
                <div className="min-h-[200px]">
                    {step === 1 && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                {STEPS[0].description}
                            </p>
                            <Input
                                placeholder="Search conditions..."
                                value={conditionSearch}
                                onChange={(e) => setConditionSearch(e.target.value)}
                                className="h-10"
                            />
                            <div className="flex flex-wrap gap-2">
                                {popularConditions
                                    .filter(c =>
                                        !conditionSearch ||
                                        c.label.toLowerCase().includes(conditionSearch.toLowerCase())
                                    )
                                    .map((c) => (
                                        <button
                                            key={c.slug}
                                            onClick={() => setCondition(c.slug)}
                                            className={cn(
                                                "px-3 py-1.5 text-sm rounded-full border transition-colors",
                                                condition === c.slug
                                                    ? "bg-primary/10 border-primary text-primary font-medium"
                                                    : "bg-secondary/50 border-transparent text-foreground hover:bg-secondary"
                                            )}
                                        >
                                            {c.label}
                                        </button>
                                    ))
                                }
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                {STEPS[1].description}
                            </p>
                            <div className="space-y-2">
                                <Label htmlFor="wizard-zip" className="text-sm font-medium">
                                    ZIP Code
                                </Label>
                                <Input
                                    id="wizard-zip"
                                    placeholder="Enter your ZIP code"
                                    value={zip}
                                    onChange={(e) => setZip(e.target.value)}
                                    className="h-10"
                                    maxLength={5}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Optional — leave blank to search nationwide.
                                </p>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-5">
                            <p className="text-sm text-muted-foreground">
                                {STEPS[2].description}
                            </p>
                            <div className="space-y-2">
                                <Label htmlFor="wizard-age" className="text-sm font-medium">
                                    Age
                                </Label>
                                <Input
                                    id="wizard-age"
                                    type="number"
                                    placeholder="Your age"
                                    value={age}
                                    onChange={(e) => setAge(e.target.value)}
                                    className="h-10 w-24"
                                    min={0}
                                    max={120}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Biological Sex</Label>
                                <RadioGroup value={sex} onValueChange={setSex} className="flex gap-4">
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="male" id="wizard-male" />
                                        <Label htmlFor="wizard-male" className="text-sm cursor-pointer">Male</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="female" id="wizard-female" />
                                        <Label htmlFor="wizard-female" className="text-sm cursor-pointer">Female</Label>
                                    </div>
                                </RadioGroup>
                                <p className="text-xs text-muted-foreground">
                                    Optional — used to filter sex-specific trials.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                    <Button
                        variant="ghost"
                        onClick={handleBack}
                        disabled={step === 1}
                        className="gap-1"
                    >
                        <ChevronLeft size={16} />
                        Back
                    </Button>
                    <Button
                        variant="brand"
                        onClick={() => void handleNext()}
                        disabled={!canProceed()}
                        className="gap-1"
                    >
                        {step === 3 ? 'Find Trials' : 'Next'}
                        {step < 3 && <ChevronRight size={16} />}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

'use client';

import { useSavedTrials } from '@/lib/compare/state';
import TrialRowAdapter from '@/components/trials/TrialRowAdapter';
import ComparisonTable from '@/components/trials/ComparisonTable';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Bookmark, Users } from 'lucide-react';
import { useState } from 'react';

export default function SavedTrialsClient() {
    const { savedTrials, selectedForCompare, toggleCompareSelection, clearCompareSelection } = useSavedTrials();
    const [compareMode, setCompareMode] = useState(false);

    const selectedTrials = savedTrials.filter(t => selectedForCompare.includes(t.nct_id));

    if (savedTrials.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="mb-6 rounded-full bg-pm-border/30 p-4">
                    <Bookmark className="h-8 w-8 text-pm-muted" />
                </div>
                <h2 className="mb-2 text-2xl font-semibold text-pm-ink">No trials saved on this device yet</h2>
                <p className="mb-8 max-w-md text-pm-muted">
                    Saved trials stay in this browser so you can come back later without creating an account.
                </p>
                <div className="flex gap-4">
                    <Button asChild>
                        <Link href="/trials">Search trials</Link>
                    </Button>

                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-4xl">
            <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button asChild variant="ghost" size="sm" className="-ml-2">
                        <Link href="/trials">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to browse
                        </Link>
                    </Button>
                </div>
                <div className="flex items-center gap-2">
                    {compareMode && selectedForCompare.length > 0 && (
                        <Button variant="outline" size="sm" onClick={clearCompareSelection}>
                            Clear selection
                        </Button>
                    )}
                    <Button
                        variant={compareMode ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setCompareMode(!compareMode)}
                    >
                        <Users className="mr-2 h-4 w-4" />
                        {compareMode ? 'Done comparing' : 'Compare trials'}
                    </Button>
                </div>
            </div>

            <div className="mb-8">
                <h1 className="text-3xl font-semibold text-pm-ink">Saved on this device</h1>
                <p className="mt-2 text-pm-muted">
                    You have saved {savedTrials.length} trial{savedTrials.length === 1 ? '' : 's'} in this browser.
                    Clearing browser storage will remove this list.
                </p>
            </div>

            {compareMode && selectedTrials.length > 0 && (
                <div className="mb-12 animate-in fade-in slide-in-from-top-4">
                    <h2 className="mb-4 text-xl font-semibold text-pm-ink">Comparing {selectedTrials.length} trials</h2>
                    <ComparisonTable trials={selectedTrials} onRemove={toggleCompareSelection} />
                </div>
            )}

            <div className="overflow-hidden rounded-3xl border border-foreground/10 bg-white/80 backdrop-blur">
                {savedTrials.map((trial, index) => (
                    <TrialRowAdapter
                        key={trial.nct_id}
                        {...trial}
                        rowIndex={index}
                        mode="browse" // Default to browse mode for saved list
                        showCompareSelect={compareMode}
                    />
                ))}
            </div>
        </div>
    );
}

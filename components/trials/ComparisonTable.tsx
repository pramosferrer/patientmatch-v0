'use client';

import { SavedTrial } from '@/lib/compare/state';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { formatAge, formatPhase } from '@/lib/trials/formatters';

interface ComparisonTableProps {
    trials: SavedTrial[];
    onRemove: (nctId: string) => void;
}

export default function ComparisonTable({ trials, onRemove }: ComparisonTableProps) {
    if (trials.length === 0) return null;

    return (
        <div className="rounded-xl border border-pm-border overflow-hidden bg-white shadow-sm">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[200px] bg-pm-bg/50">Feature</TableHead>
                            {trials.map((trial) => (
                                <TableHead key={trial.nct_id} className="min-w-[250px] bg-pm-bg/50 relative">
                                    <div className="pr-8">
                                        <span className="line-clamp-2" title={trial.title}>
                                            {trial.title}
                                        </span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute top-2 right-2 h-6 w-6 text-pm-muted hover:text-red-500"
                                        onClick={() => onRemove(trial.nct_id)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell className="font-medium text-pm-muted">Phase</TableCell>
                            {trials.map((trial) => (
                                <TableCell key={trial.nct_id}>
                                    {formatPhase(trial.phase ?? undefined) || 'N/A'}
                                </TableCell>
                            ))}
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium text-pm-muted">Locations</TableCell>
                            {trials.map((trial) => (
                                <TableCell key={trial.nct_id}>
                                    {trial.location_countries?.join(', ') || 'Not specified'}
                                    {trial.site_count ? ` (${trial.site_count} sites)` : ''}
                                </TableCell>
                            ))}
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium text-pm-muted">Age Range</TableCell>
                            {trials.map((trial) => (
                                <TableCell key={trial.nct_id}>
                                    {formatAge(trial.min_age_years ?? undefined, trial.max_age_years ?? undefined)}
                                </TableCell>
                            ))}
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium text-pm-muted">Sponsor</TableCell>
                            {trials.map((trial) => (
                                <TableCell key={trial.nct_id}>{trial.sponsor || '—'}</TableCell>
                            ))}
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium text-pm-muted">ID</TableCell>
                            {trials.map((trial) => (
                                <TableCell key={trial.nct_id} className="font-mono text-xs text-pm-muted">
                                    {trial.nct_id}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

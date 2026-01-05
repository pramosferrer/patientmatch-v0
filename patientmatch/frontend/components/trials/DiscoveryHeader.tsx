'use client';

import { useRouter } from 'next/navigation';
import { updateProfileBatch } from '@/app/actions';
import type { ProfileCookie } from '@/shared/profileCookie';
import type { MatchConfidenceResult } from '@/lib/matching/matchConfidence';
import TrialsSentenceHeader from './TrialsSentenceHeader';

type DiscoveryHeaderProps = {
    condition?: string;
    zip?: string;
    profile: ProfileCookie | null;
    totalCount: number;
    profileMatchResult?: MatchConfidenceResult;
};

export default function DiscoveryHeader({
    condition,
    zip,
    profile,
    totalCount,
    profileMatchResult,
}: DiscoveryHeaderProps) {
    const router = useRouter();

    const handleClearAll = async () => {
        await updateProfileBatch({
            age: null,
            sex: null,
            radius: null,
            zip: null,
            conditions: [],
            pregnancy: null,
        });
        router.push('/trials');
    };

    return (
        <div className="sticky top-0 z-30 bg-slate-50/70 backdrop-blur-md px-4 py-5 transition-all">
            <div className="pm-container">
                <TrialsSentenceHeader
                    condition={condition}
                    zip={zip}
                    profile={profile}
                />
            </div>
        </div>
    );
}

'use client';

import type { ProfileCookie } from '@/shared/profileCookie';
import TrialsSentenceHeader from './TrialsSentenceHeader';

type DiscoveryHeaderProps = {
    condition?: string;
    zip?: string;
    profile: ProfileCookie | null;
};

export default function DiscoveryHeader({
    condition,
    zip,
    profile,
}: DiscoveryHeaderProps) {
    return (
        <div className="sticky top-16 z-30 -mx-4 px-4 py-5 bg-background/95 backdrop-blur-md">
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

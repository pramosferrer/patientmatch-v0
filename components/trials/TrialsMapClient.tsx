'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type TrialsMap from '@/components/trials/TrialsMap';

// Leaflet accesses window on import — must be client-only with ssr:false
const TrialsMapLazy = dynamic(() => import('@/components/trials/TrialsMap'), {
  ssr: false,
  loading: () => (
    <div
      className="w-full bg-muted/20 animate-pulse"
      style={{ height: 'calc(100vh - 128px)', minHeight: 480 }}
    />
  ),
});

type Props = ComponentProps<typeof TrialsMap>;

export default function TrialsMapClient(props: Props) {
  return <TrialsMapLazy {...props} />;
}

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Bookmark } from 'lucide-react';
import { useSavedTrials } from '@/lib/compare/state';
import Link from 'next/link';

export default function CompareDrawer({ children }: { children?: React.ReactNode }) {
  const { savedTrials } = useSavedTrials();

  if (savedTrials.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm flex justify-center md:justify-end">
      <Link href="/saved">
        <Button
          className="bg-pm-primary hover:bg-pm-primaryHover text-white shadow-lg rounded-full px-6"
        >
          <Bookmark className="mr-2 h-4 w-4" />
          Saved Trials ({savedTrials.length})
        </Button>
      </Link>
    </div>
  );
}

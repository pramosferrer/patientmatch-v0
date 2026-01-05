'use client';

import { useEffect, useRef } from "react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { getSavedTrialIds, clearSavedTrials } from "@/lib/trials/savedTrialsStore";

const MERGE_ENDPOINT = "/api/user/merge-guest";

export function AuthSessionBridge() {
  const { user, session } = useSupabaseAuth();
  const mergedUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !session) {
      return;
    }

    if (mergedUserRef.current === user.id) {
      return;
    }

    const savedTrials = getSavedTrialIds();

    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(MERGE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            saved_trials: savedTrials,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          return;
        }

        mergedUserRef.current = user.id;
        if (savedTrials.length > 0) {
          clearSavedTrials();
        }
      } catch {
        // Ignore network errors; we'll retry on the next auth change.
      }
    })();

    return () => controller.abort();
  }, [session, user]);

  return null;
}

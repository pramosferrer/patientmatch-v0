'use client';

import { useCallback, useSyncExternalStore } from "react";
import {
  addSavedTrial,
  clearSavedTrials,
  getSavedTrialIds,
  removeSavedTrial,
  subscribeSavedTrials,
} from "@/lib/trials/savedTrialsStore";

function normalize(nctId: string): string {
  return nctId.trim().toUpperCase();
}

export function useSavedTrials() {
  const savedIds = useSyncExternalStore(subscribeSavedTrials, getSavedTrialIds, getSavedTrialIds);

  const isSaved = useCallback(
    (nctId: string) => savedIds.includes(normalize(nctId)),
    [savedIds],
  );

  const saveTrial = useCallback((nctId: string) => addSavedTrial(nctId), []);

  const removeTrial = useCallback((nctId: string) => removeSavedTrial(nctId), []);

  const clear = useCallback(() => clearSavedTrials(), []);

  return {
    savedIds,
    isSaved,
    saveTrial,
    removeTrial,
    clear,
  };
}

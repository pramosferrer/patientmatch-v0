'use client';

import { useState, useEffect, useCallback } from 'react';

export interface SavedTrial {
  nct_id: string;
  title: string;
  phase?: string | null;
  site_count?: number | null;
  min_age_years?: number | null;
  max_age_years?: number | null;
  location_countries?: string[] | null;
  sponsor?: string | null;
  savedAt: number;
}

const SAVED_TRIALS_STORAGE_KEY = 'patientmatch_saved_trials';
const MAX_SHORTLIST_ITEMS = 50;

// Global state
let globalSavedTrials: SavedTrial[] = [];
let listeners: Set<() => void> = new Set();
let initialized = false;

const notifyListeners = () => {
  listeners.forEach(listener => listener());
};

const loadFromStorage = () => {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem(SAVED_TRIALS_STORAGE_KEY);
    if (stored) {
      globalSavedTrials = JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load saved trials from localStorage:', error);
  }
};

const saveToStorage = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SAVED_TRIALS_STORAGE_KEY, JSON.stringify(globalSavedTrials));
  } catch (error) {
    console.error('Failed to save saved trials to localStorage:', error);
  }
};

export function useSavedTrials() {
  // Initialize on first use (client-side only)
  if (!initialized && typeof window !== 'undefined') {
    loadFromStorage();
    initialized = true;
  }

  const [savedTrials, setSavedTrials] = useState<SavedTrial[]>(globalSavedTrials);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  useEffect(() => {
    const listener = () => {
      setSavedTrials(globalSavedTrials);
    };
    listeners.add(listener);
    // Sync immediately in case it changed before effect ran
    setSavedTrials(globalSavedTrials);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const saveTrial = useCallback((trial: Omit<SavedTrial, 'savedAt'>) => {
    if (globalSavedTrials.some(t => t.nct_id === trial.nct_id)) {
      return; // Already saved
    }
    globalSavedTrials = [...globalSavedTrials, { ...trial, savedAt: Date.now() }];
    saveToStorage();
    notifyListeners();
  }, []);

  const removeTrial = useCallback((nctId: string) => {
    globalSavedTrials = globalSavedTrials.filter(t => t.nct_id !== nctId);
    saveToStorage();
    notifyListeners();
    setSelectedForCompare(prev => prev.filter(id => id !== nctId));
  }, []);

  const isSaved = useCallback((nctId: string) => {
    return savedTrials.some(t => t.nct_id === nctId);
  }, [savedTrials]);

  const toggleCompareSelection = useCallback((nctId: string) => {
    setSelectedForCompare(prev => {
      if (prev.includes(nctId)) {
        return prev.filter(id => id !== nctId);
      }
      if (prev.length >= 3) {
        return prev; // Max 3 for comparison
      }
      return [...prev, nctId];
    });
  }, []);

  const clearCompareSelection = useCallback(() => {
    setSelectedForCompare([]);
  }, []);

  return {
    savedTrials,
    saveTrial,
    removeTrial,
    isSaved,
    selectedForCompare,
    toggleCompareSelection,
    clearCompareSelection,
    canSelectMore: selectedForCompare.length < 3
  };
}

export function useShortlist() {
  const { savedTrials, saveTrial, removeTrial, isSaved } = useSavedTrials();
  const canAddMore = savedTrials.length < MAX_SHORTLIST_ITEMS;

  const addToShortlist = useCallback(
    (trial: Omit<SavedTrial, 'savedAt'>) => {
      if (savedTrials.some((entry) => entry.nct_id === trial.nct_id)) {
        return true;
      }
      if (!canAddMore) {
        return false;
      }
      saveTrial(trial);
      return true;
    },
    [canAddMore, saveTrial, savedTrials],
  );

  const removeFromShortlist = useCallback(
    (nctId: string) => {
      removeTrial(nctId);
    },
    [removeTrial],
  );

  const isInShortlist = useCallback((nctId: string) => isSaved(nctId), [isSaved]);

  return {
    addToShortlist,
    removeFromShortlist,
    isInShortlist,
    canAddMore,
  };
}

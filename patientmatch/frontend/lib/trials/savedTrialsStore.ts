'use client';

type Listener = (ids: string[]) => void;

const STORAGE_KEY = "pm:savedTrials";
const listeners = new Set<Listener>();

function normalizeTrialId(candidate: string): string {
  return candidate.trim().toUpperCase();
}

function readFromStorage(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return Array.from(
      new Set(
        parsed
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
          .map(normalizeTrialId),
      ),
    );
  } catch {
    return [];
  }
}

function writeToStorage(ids: string[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (ids.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    }
  } catch {
    /* ignore storage write issues */
  }
}

function notify(ids: string[]): void {
  listeners.forEach((listener) => {
    try {
      listener(ids);
    } catch {
      /* ignore listener errors */
    }
  });
}

export function getSavedTrialIds(): string[] {
  return readFromStorage();
}

export function isTrialSaved(nctId: string): boolean {
  const normalized = normalizeTrialId(nctId);
  return readFromStorage().includes(normalized);
}

export function addSavedTrial(nctId: string): string[] {
  const normalized = normalizeTrialId(nctId);
  const existing = readFromStorage();
  if (existing.includes(normalized)) {
    return existing;
  }
  const next = [...existing, normalized];
  writeToStorage(next);
  notify(next);
  return next;
}

export function removeSavedTrial(nctId: string): string[] {
  const normalized = normalizeTrialId(nctId);
  const existing = readFromStorage();
  const next = existing.filter((id) => id !== normalized);
  if (next.length === existing.length) {
    return existing;
  }
  writeToStorage(next);
  notify(next);
  return next;
}

export function replaceSavedTrials(ids: string[]): void {
  const normalized = Array.from(
    new Set(
      ids
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map(normalizeTrialId),
    ),
  );
  writeToStorage(normalized);
  notify(normalized);
}

export function clearSavedTrials(): void {
  writeToStorage([]);
  notify([]);
}

export function subscribeSavedTrials(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

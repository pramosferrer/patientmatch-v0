'use client';

import { useMemo } from 'react';
import { toConditionLabel } from '@/shared/conditions-normalize';

export type TrialsStateInput = {
  condition?: string | null;
  zip?: string | null;
  radius?: number | null;
  age?: number | null;
  sex?: 'male' | 'female' | 'other' | string | null;
};

export type TrialsState = {
  // Core derived state
  isNationwide: boolean;

  // Display labels for UI
  displayCondition: string;
  displayZip: string;
  displayDistance: string;
  displaySex: string;
  displayAge: string;

  // Sort configuration
  sortOptions: { id: string; label: string }[];
  defaultSort: string;
};

const DEFAULT_RADIUS = 50;

/**
 * Centralized hook to derive shared trials state.
 * Used across TrialsSentenceHeader, TrialsToolbar, and PublicTrialCard
 * to ensure consistent isNationwide / display logic.
 */
export function useTrialsState(input: TrialsStateInput): TrialsState {
  return useMemo(() => {
    const { condition, zip, radius, age, sex } = input;

    // Nationwide when no zip provided
    const isNationwide = !zip || zip.trim() === '';

    // Condition display
    const displayCondition =
      condition && condition !== 'all'
        ? toConditionLabel(condition)
        : 'any condition';

    // Location display
    const displayZip = isNationwide ? 'nationwide' : (zip || '');

    // Distance display (hidden when nationwide)
    const effectiveRadius = radius ?? DEFAULT_RADIUS;
    const displayDistance = isNationwide ? '' : `${effectiveRadius} mi`;

    // Sex display
    let displaySex = 'any sex';
    if (sex === 'male') displaySex = 'male';
    else if (sex === 'female') displaySex = 'female';

    // Age display
    const displayAge = age && age > 0 ? `${age}` : 'any';

    // Sort options - hide distance when nationwide
    const sortOptions = isNationwide
      ? [{ id: 'recruiting', label: 'Recruiting first' }]
      : [
          { id: 'distance', label: 'Nearest first' },
          { id: 'recruiting', label: 'Recruiting first' },
        ];

    // Default sort
    const defaultSort = isNationwide ? 'recruiting' : 'distance';

    return {
      isNationwide,
      displayCondition,
      displayZip,
      displayDistance,
      displaySex,
      displayAge,
      sortOptions,
      defaultSort,
    };
  }, [input.condition, input.zip, input.radius, input.age, input.sex]);
}

/**
 * Pure function version for server-side usage
 */
export function deriveTrialsState(input: TrialsStateInput): TrialsState {
  const { condition, zip, radius, age, sex } = input;

  const isNationwide = !zip || zip.trim() === '';

  const displayCondition =
    condition && condition !== 'all'
      ? toConditionLabel(condition)
      : 'any condition';

  const displayZip = isNationwide ? 'nationwide' : (zip || '');

  const effectiveRadius = radius ?? DEFAULT_RADIUS;
  const displayDistance = isNationwide ? '' : `${effectiveRadius} mi`;

  let displaySex = 'any sex';
  if (sex === 'male') displaySex = 'male';
  else if (sex === 'female') displaySex = 'female';

  const displayAge = age && age > 0 ? `${age}` : 'any';

  const sortOptions = isNationwide
    ? [{ id: 'recruiting', label: 'Recruiting first' }]
    : [
        { id: 'distance', label: 'Nearest first' },
        { id: 'recruiting', label: 'Recruiting first' },
      ];

  const defaultSort = isNationwide ? 'recruiting' : 'distance';

  return {
    isNationwide,
    displayCondition,
    displayZip,
    displayDistance,
    displaySex,
    displayAge,
    sortOptions,
    defaultSort,
  };
}

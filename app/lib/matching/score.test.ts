import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  combineToConfidence,
  computeEligibilityScore,
  computeLogisticsScore,
  computePriorityScore,
  type MatchingPatient,
  type MatchingTrial,
} from './score';
import type { EvalResult } from '@/shared/match/evaluate';

describe('matching score helpers', () => {
  it('reduces eligibility when unknown items remain', () => {
    const evaluation: EvalResult = {
      hard_ok: true,
      soft_hits: [],
      unknown: ['labs'],
      reasons: ['Meets core criteria'],
    };
    const patient: MatchingPatient = {};
    const trial: MatchingTrial = { evaluation };

    const eligibility = computeEligibilityScore(patient, trial);

    assert.equal(Number(eligibility.value.toFixed(2)), 0.85);
    assert.ok(
      eligibility.reasons.some((reason) =>
        reason.toLowerCase().includes('follow-up'),
      ),
    );
  });

  it('scores logistics using distance buckets and remote preference', () => {
    const patient: MatchingPatient = {
      profile: { prefers_remote: true },
    };
    const trial: MatchingTrial = { visit_model: 'remote' };

    const logistics = computeLogisticsScore(
      patient,
      trial,
      8,
      null,
    );

    assert.equal(Number(logistics.value.toFixed(2)), 0.90);
    assert.ok(
      logistics.reasons.some((reason) =>
        reason.toLowerCase().includes('within 10 miles'),
      ),
    );
    assert.ok(
      logistics.reasons.some((reason) =>
        reason.toLowerCase().includes('remote participation'),
      ),
    );
  });

  it('returns high priority value for recruiting status', () => {
    const trial: MatchingTrial = {
      status: 'Recruiting',
    };

    const priority = computePriorityScore(trial);

    assert.equal(priority.value, 1);
    assert.ok(priority.reasons.some((reason) => reason.toLowerCase().includes('recruiting')));
  });

  it('combines component scores into a weighted confidence', () => {
    const eligibility = { value: 0.7, reasons: [] };
    const logistics = { value: 0.8, reasons: [] };
    const priority = { value: 0.6, reasons: [] };

    const combined = combineToConfidence(eligibility, logistics, priority);

    assert.equal(Number(combined.score.toFixed(3)), 0.705);
    assert.equal(combined.confidence, 71);
  });
});

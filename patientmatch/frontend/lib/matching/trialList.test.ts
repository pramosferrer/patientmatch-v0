import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sortTrialsByDistance, sortTrialsByQualityScore } from "./trialList";

describe("trial list sorting helpers", () => {
  it("sorts by distance ascending with nulls last", () => {
    const trials = [
      { nct_id: "A", distance_miles: 12 },
      { nct_id: "B", distance_miles: null },
      { nct_id: "C", distance_miles: 5 },
    ];

    const sorted = sortTrialsByDistance(trials);
    assert.deepEqual(
      sorted.map((trial) => trial.nct_id),
      ["C", "A", "B"],
    );
  });

  it("sorts by quality score desc with title tiebreakers", () => {
    const trials = [
      { nct_id: "A", quality_score: 0.6, title: "Zeta Study" },
      { nct_id: "B", quality_score: 0.6, title: "Alpha Study" },
      { nct_id: "C", quality_score: null, title: "Beta Study" },
      { nct_id: "D", quality_score: 0.9, title: "Delta Study" },
    ];

    const sorted = sortTrialsByQualityScore(trials);
    assert.deepEqual(
      sorted.map((trial) => trial.nct_id),
      ["D", "B", "A", "C"],
    );
  });
});

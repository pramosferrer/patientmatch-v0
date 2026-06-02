import assert from "node:assert/strict";
import { describe, it } from "node:test";

import demoTrials from "@/fixtures/demo/trials.json";
import { pmqToUiQuestions } from "@/lib/pmqAdapter";

describe("demo PMQ fixture", () => {
  it("renders synthetic questionnaire questions without profile context", () => {
    const [trial] = demoTrials;
    const result = pmqToUiQuestions(trial.questionnaire_json, null);

    assert.equal(trial.nct_id, "NCT00000001");
    assert.deepEqual(
      result.mainQuestions.map((question) => question.id),
      ["age_years", "diagnosis_confirmed", "recent_treatment"],
    );
    assert.equal(result.initialAnswers.age_years, undefined);
  });

  it("dedupes global profile questions from the synthetic questionnaire", () => {
    const [trial] = demoTrials;
    const result = pmqToUiQuestions(trial.questionnaire_json, {
      age_years: 42,
      diagnosis_confirmed: true,
      sex_at_birth: "female",
      zip: "02115",
    });

    assert.deepEqual(
      result.mainQuestions.map((question) => question.id),
      ["recent_treatment"],
    );
    assert.equal(result.initialAnswers.age_years, 42);
    assert.equal(result.initialAnswers.diagnosis_confirmed, true);
    assert.equal(result.initialAnswers.sex_at_birth, "female");
    assert.equal(result.initialAnswers.zip, "02115");
  });
});

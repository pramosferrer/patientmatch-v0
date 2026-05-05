import assert from "node:assert/strict";
import test from "node:test";

import { pmqToUiQuestions } from "@/lib/pmqAdapter";
import { evaluateTrial, type EvaluationResult } from "@/lib/matching/evaluator";

function evaluatePmq(pmq: unknown, answers: Record<string, unknown>): EvaluationResult {
  const ui = pmqToUiQuestions(pmq, null);
  const questionnaire = {
    include: ui.mainQuestions.filter((question) => question.clause.type === "inclusion"),
    exclude: ui.mainQuestions.filter((question) => question.clause.type === "exclusion"),
  };

  return evaluateTrial(questionnaire, answers, {
    trial: {
      nct_id: "TEST",
      gender: "ALL",
      min_age_years: null,
      max_age_years: null,
    },
  });
}

test("PMQ boolean exclusion answers stop as no-match", () => {
  const result = evaluatePmq(
    {
      questions: [
        {
          question_key: "pregnant",
          text: "Are you currently pregnant or think you might be pregnant?",
          answer_type: "single_select",
          options: ["Yes", "No", "Not sure"],
          logic: [{ type: "criterion", section: "exclusion", disqualify_when: "Yes" }],
        },
      ],
    },
    { pregnant: "Yes" },
  );

  assert.equal(result.result, "no");
});

test("PMQ multi-select exclusion distinguishes none from selected condition", () => {
  const pmq = {
    questions: [
      {
        question_key: "hiv_or_hepatitis",
        text: "Have you been diagnosed with any of these?",
        answer_type: "multi_select",
        options: ["HIV", "Hepatitis B", "Hepatitis C", "None of the above", "Not sure"],
        logic: [{ type: "criterion", section: "exclusion", disqualify_when: "Yes" }],
      },
    ],
  };

  assert.notEqual(evaluatePmq(pmq, { hiv_or_hepatitis: ["None of the above"] }).result, "no");
  assert.equal(evaluatePmq(pmq, { hiv_or_hepatitis: ["HIV"] }).result, "no");
});

test("PMQ numeric threshold exclusion uses the threshold", () => {
  const pmq = {
    questions: [
      {
        question_key: "systolic_bp",
        text: "What is your systolic blood pressure?",
        answer_type: "number",
        logic: [
          {
            type: "criterion",
            section: "exclusion",
            disqualify_when: "Yes",
            params: { operator: ">", threshold: 160, unit: "mmHg" },
          },
        ],
      },
    ],
  };

  assert.notEqual(evaluatePmq(pmq, { systolic_bp: 120 }).result, "no");
  assert.equal(evaluatePmq(pmq, { systolic_bp: 180 }).result, "no");
});

test("PMQ disqualify_when No is treated as a real exclusion answer", () => {
  const result = evaluatePmq(
    {
      questions: [
        {
          question_key: "willing_contraception",
          text: "If you could become pregnant, would you use birth control during the study?",
          answer_type: "single_select",
          options: ["Yes", "No", "Not applicable", "Not sure"],
          logic: [{ type: "criterion", section: "inclusion", disqualify_when: "No" }],
        },
      ],
    },
    { willing_contraception: "No" },
  );

  assert.equal(result.result, "no");
});

test("PMQ Not sure remains unknown rather than automatic no-match", () => {
  const result = evaluatePmq(
    {
      questions: [
        {
          question_key: "pregnant",
          text: "Are you currently pregnant or think you might be pregnant?",
          answer_type: "single_select",
          options: ["Yes", "No", "Not sure"],
          logic: [{ type: "criterion", section: "exclusion", disqualify_when: "Yes" }],
        },
      ],
    },
    { pregnant: "Not sure" },
  );

  assert.notEqual(result.result, "no");
});

test("PMQ role inclusion answers can rule out non-matching participants", () => {
  const pmq = {
    questions: [
      {
        question_key: "caregiver_role",
        text: "Are you the caregiver or family member this study is looking for?",
        answer_type: "single_select",
        options: ["Yes", "No", "Not sure"],
        logic: [{ type: "criterion", section: "exclusion", disqualify_when: "No" }],
      },
    ],
  };

  assert.equal(evaluatePmq(pmq, { caregiver_role: "No" }).result, "no");
  assert.notEqual(evaluatePmq(pmq, { caregiver_role: "Yes" }).result, "no");
});

test("PMQ numeric range inclusion is evaluated from min and max params", () => {
  const pmq = {
    questions: [
      {
        question_key: "bmi",
        text: "If you know your body mass index (BMI), what is it?",
        answer_type: "number",
        logic: [
          {
            type: "criterion",
            section: "inclusion",
            params: { operator: "between", min: 18, max: 32, unit: "kg/m2" },
          },
        ],
      },
    ],
  };

  assert.equal(evaluatePmq(pmq, { bmi: 17 }).unmet_details[0]?.id, "bmi");
  assert.notEqual(evaluatePmq(pmq, { bmi: 24 }).result, "no");
});

#!/usr/bin/env node

try {
  // Ensure TypeScript files can be required.
  require("ts-node/register/transpile-only");
} catch (error) {
  console.error("label-check: ts-node is required to run this script.");
  process.exit(1);
}

const phrasebook = require("../frontend/lib/criteria/phrasebook") as typeof import("../frontend/lib/criteria/phrasebook");
const { toPatientLabel } = phrasebook;
type CriteriaClause = import("../frontend/lib/criteria/adapter").CriteriaClause;

const failures: string[] = [];

function buildClause(partial: Partial<CriteriaClause>): CriteriaClause {
  return {
    criterion_id: partial.criterion_id ?? "clause",
    type: partial.type ?? "inclusion",
    category: partial.category ?? "demographics",
    source: partial.source ?? "patient",
    rule: partial.rule,
    critical: partial.critical ?? false,
  };
}

function assertEqual(actual: string | undefined, expected: string, description: string) {
  if (actual !== expected) {
    failures.push(`${description} expected "${expected}" but received "${actual ?? "undefined"}"`);
  }
}

function runChecks() {
  const ageClause = buildClause({
    criterion_id: "age_years",
    rule: { variable: "age_years", operator: ">=", value: 18 },
  });
  const ageLabel = toPatientLabel(ageClause);
  assertEqual(ageLabel.label, "What is your age?", "Age label");
  assertEqual(ageLabel.unit, "years", "Age unit");

  const heightClause = buildClause({
    criterion_id: "height_cm",
    rule: { variable: "height_cm", operator: "between", value: [150, 190] },
  });
  const heightLabel = toPatientLabel(heightClause);
  assertEqual(heightLabel.label, "What is your height?", "Height label");
  assertEqual(heightLabel.unit, "cm", "Height unit");

  const pregnancyClause = buildClause({
    criterion_id: "pregnant",
    type: "exclusion",
    rule: { variable: "pregnant", operator: "is", value: true },
  });
  const pregnancyLabel = toPatientLabel(pregnancyClause);
  assertEqual(pregnancyLabel.label, "Are you currently pregnant?", "Pregnancy label");

  const diagnosisClause = buildClause({
    criterion_id: "diagnosis",
    rule: { variable: "diagnosis", operator: "in", value: ["Condition A", "Condition B"] },
  });
  const diagnosisLabel = toPatientLabel(diagnosisClause);
  assertEqual(
    diagnosisLabel.label,
    "Have you been diagnosed with any of the following conditions?",
    "Diagnosis label",
  );
  assertEqual(diagnosisLabel.helperText, "Select all that apply.", "Diagnosis helper text");
}

runChecks();

if (failures.length > 0) {
  failures.forEach((failure) => console.error(`label-check: ${failure}`));
  process.exit(1);
}

console.log("Label checks passed ✅");

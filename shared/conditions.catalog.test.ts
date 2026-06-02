import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getConditionFilterValues } from "./conditions.catalog";

describe("condition catalog filters", () => {
  it("includes slug, label, synonym labels, and synonym slugs for seed counts", () => {
    const values = getConditionFilterValues({
      slug: "migraine",
      label: "Migraine",
      synonyms: ["migraine disorders", "chronic migraine", "headache"],
    });

    assert.equal(values.includes("migraine"), true);
    assert.equal(values.includes("Migraine"), true);
    assert.equal(values.includes("migraine disorders"), true);
    assert.equal(values.includes("migraine_disorders"), true);
    assert.equal(values.includes("chronic migraine"), true);
    assert.equal(values.includes("chronic_migraine"), true);
  });
});

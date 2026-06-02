import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { screenerHrefFromSearch, trialHrefFromSearch, trialProfileQueryParams } from "./urls";

describe("trial profile URL helpers", () => {
  it("preserves only allowed patient profile params", () => {
    const params = new URLSearchParams({
      condition: "migraine",
      zip: "10001",
      age: "45",
      sex: "female",
      radius: "50",
      page: "2",
      debug: "1",
    });

    assert.deepEqual(trialProfileQueryParams(params), {
      condition: "migraine",
      zip: "10001",
      age: "45",
      sex: "female",
      radius: "50",
    });
    assert.equal(
      screenerHrefFromSearch({ nct_id: "nct123" }, params),
      "/trial/NCT123/screen?mode=patient&condition=migraine&zip=10001&age=45&sex=female&radius=50",
    );
    assert.equal(
      trialHrefFromSearch({ nct_id: "NCT123" }, params),
      "/trial/NCT123?condition=migraine&zip=10001&age=45&sex=female&radius=50",
    );
  });
});

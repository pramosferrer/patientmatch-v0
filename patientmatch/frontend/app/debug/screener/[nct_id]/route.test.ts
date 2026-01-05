import assert from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";

const MODULE_PATH = "./route";

describe("debug/screener API route", () => {
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it("returns 404 in production", async () => {
    process.env.NODE_ENV = "production";
    const { GET } = await import(`${MODULE_PATH}?ts=${Date.now()}`);
    const response = await GET(new Request("http://localhost/debug/screener/NCT123"), {
      params: { nct_id: "NCT123" },
    });

    assert.strictEqual(response.status, 404);
    const data = await response.json();
    assert.strictEqual(data.error, "Not available");
  });

  it("returns 400 when nct_id is missing", async () => {
    process.env.NODE_ENV = "development";
    const { GET } = await import(`${MODULE_PATH}?ts=${Date.now()}`);
    const response = await GET(new Request("http://localhost/debug/screener/"), {
      params: { nct_id: "" },
    });

    assert.strictEqual(response.status, 400);
    const data = await response.json();
    assert.strictEqual(data.error, "Missing nct_id");
  });
});

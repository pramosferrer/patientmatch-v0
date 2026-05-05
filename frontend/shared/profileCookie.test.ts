import assert from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import { NextRequest, NextResponse } from "next/server";

const MODULE_PATH = "./profileCookie";

describe("profile cookie helpers", () => {
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.PII_SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.PII_SECRET;
    } else {
      process.env.PII_SECRET = originalSecret;
    }
  });

  it("throws during module evaluation when PII_SECRET is missing", async () => {
    delete process.env.PII_SECRET;
    await assert.rejects(
      import(`${MODULE_PATH}?ts=${Date.now()}`),
      /PII_SECRET environment variable is required/,
    );
  });

  it("encrypts and decrypts profile payload", async () => {
    process.env.PII_SECRET = "c".repeat(32);
    const mod = await import(`${MODULE_PATH}?ts=${Date.now()}`);
    const { setProfileCookie, readProfileCookie, clearProfileCookie } = mod;

    const response = NextResponse.json({ ok: true });
    await setProfileCookie(response, {
      age: 39,
      sex: "female",
      zip: "10001",
      pregnancy: false,
      conditions: ["long-covid"],
    });

    const stored = response.cookies.get("pm_profile");
    assert.ok(stored?.value);

    const request = new NextRequest("http://localhost/profile", {
      headers: new Headers({
        cookie: `pm_profile=${stored.value}`,
      }),
    });
    const parsed = await readProfileCookie(request);
    assert.deepStrictEqual(parsed, {
      age: 39,
      sex: "female",
      zip: "10001",
      pregnancy: false,
      conditions: ["long-covid"],
    });

    const cleared = NextResponse.json({ ok: true });
    clearProfileCookie(cleared);
    const clearedCookie = cleared.cookies.get("pm_profile");
    assert.strictEqual(clearedCookie?.value, "");
    assert.strictEqual(clearedCookie?.maxAge, 0);
  });
});


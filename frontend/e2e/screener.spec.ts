import { test, expect, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

type Box = { x: number; y: number; width: number; height: number };

const intersectionArea = (a: Box, b: Box) => {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= left || bottom <= top) return 0;
  return (right - left) * (bottom - top);
};

async function getTrialIds(request: APIRequestContext, baseURL: string): Promise<string[]> {
  const response = await request.get(new URL("/api/trials?page=1", baseURL).toString());
  expect(response.ok()).toBeTruthy();

  const payload = await response.json();
  const ids: string[] = Array.isArray(payload?.trials)
    ? payload.trials
        .map((trial: { nct_id?: string }) => trial?.nct_id)
        .filter((value: unknown): value is string => typeof value === "string" && value.length > 0)
    : [];

  const unique = Array.from(new Set(ids));
  if (unique.length === 0) {
    return [];
  }
  if (unique.length === 1) {
    const first = unique[0];
    if (!first) return [];
    return [first, first];
  }
  return unique.slice(0, 2).filter((value): value is string => typeof value === "string");
}

async function ensureVisibleContrast(page: Page, nctId: string, baseURL: string) {
  await page.goto(new URL(`/trial/${nctId}/screen?mode=patient&debug=1`, baseURL).toString());
  await expect(page.getByRole("heading", { name: /eligibility screening/i })).toBeVisible();

  const inputContainer = page.getByTestId("pm-input-container").first();
  const uiInput = page.getByTestId("pm-input-ui").first();
  const clinicHint = page.getByTestId("clinic-hint").first();

  const hasNumericInput = await inputContainer.isVisible().catch(() => false);
  if (!hasNumericInput) {
    await expect(page.getByRole("button", { name: /continue|see results/i }).first()).toBeVisible();
    return;
  }

  await expect(uiInput).toBeVisible();
  await uiInput.fill("34");
  await expect(uiInput).toHaveValue("34");

  const uiStyles = await page.$eval("[data-testid='pm-input-ui']", (element) => {
    const computed = window.getComputedStyle(element as HTMLElement);
    return {
      opacity: computed.opacity,
      display: computed.display,
      boxShadow: computed.boxShadow,
    };
  });

  expect(Number(uiStyles.opacity)).toBeGreaterThan(0);
  expect(["block", "flex", "inline-flex"]).toContain(uiStyles.display);
  expect(uiStyles.boxShadow).not.toBe("none");

  const hintVisible = await clinicHint.isVisible().catch(() => false);
  if (!hintVisible) {
    return;
  }

  const inputBox = await inputContainer.boundingBox();
  const hintBox = await clinicHint.boundingBox();
  expect(inputBox).not.toBeNull();
  expect(hintBox).not.toBeNull();
  if (!inputBox || !hintBox) {
    throw new Error("Bounding boxes unavailable for overlap assertion");
  }

  const overlap = intersectionArea(inputBox as Box, hintBox as Box);
  expect(overlap).toBeLessThanOrEqual(4);
}

test.describe("Screener clinic hint does not cover inputs", () => {
  test("patient screener renders and accepts numeric input", async ({ page, request, browserName }, testInfo: TestInfo) => {
    test.skip(browserName !== "chromium", "Temporary Chromium-only E2E coverage.");
    const baseURL = (testInfo.project.use.baseURL as string) ?? "http://127.0.0.1:3100";
    const trialIds = await getTrialIds(request, baseURL);
    test.skip(trialIds.length === 0, "No trial IDs available in this environment.");
    const [firstTrialId] = trialIds;
    await ensureVisibleContrast(page, firstTrialId, baseURL);
  });

  test("alternate trial screener also renders key controls", async ({ page, request, browserName }, testInfo: TestInfo) => {
    test.skip(browserName !== "chromium", "Temporary Chromium-only E2E coverage.");
    const baseURL = (testInfo.project.use.baseURL as string) ?? "http://127.0.0.1:3100";
    const trialIds = await getTrialIds(request, baseURL);
    test.skip(trialIds.length === 0, "No trial IDs available in this environment.");
    const [, secondTrialId] = trialIds;
    await ensureVisibleContrast(page, secondTrialId, baseURL);
  });
});

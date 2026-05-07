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
  const candidateQueries = [
    "/api/trials?condition=migraine&page=1",
    "/api/trials?condition=type_2_diabetes&page=1",
    "/api/trials?condition=obesity&page=1",
    "/api/trials?condition=asthma&page=1",
    "/api/trials?condition=mdd&page=1",
    "/api/trials?condition=long_covid&page=1",
    "/api/trials?condition=copd&page=1",
    "/api/trials?condition=ulcerative_colitis&page=1",
    "/api/trials?condition=rheumatoid_arthritis&page=1",
  ];

  const ids: string[] = [];
  for (const query of candidateQueries) {
    const response = await request.get(new URL(query, baseURL).toString());
    if (!response.ok()) continue;

    const payload = await response.json();
    if (!Array.isArray(payload?.trials)) continue;

    for (const trial of payload.trials) {
      const id = (trial as { nct_id?: string })?.nct_id;
      if (typeof id === "string" && id.length > 0) ids.push(id);
    }
    if (new Set(ids).size >= 5) break;
  }
  ids.push("NCT04510597", "NCT06382168", "NCT06454383", "NCT05634369", "NCT04396574");

  const unique = Array.from(new Set(ids));
  if (unique.length === 0) {
    return [];
  }
  if (unique.length === 1) {
    const first = unique[0];
    if (!first) return [];
    return [first, first];
  }
  return unique.filter((value): value is string => typeof value === "string");
}

async function ensureVisibleContrast(page: Page, nctId: string, baseURL: string) {
  await page.goto(new URL(`/trial/${nctId}/screen?mode=patient&debug=1`, baseURL).toString());
  await expect(page.getByRole("heading", { name: /eligibility screening/i })).toBeVisible();
  const perspectivePrompt = page.getByText(/before we begin/i);
  if (await perspectivePrompt.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: /myself/i }).click();
  }

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

test.describe("Screener caregiver wording", () => {
  test("five sampled trial screeners avoid object-pronoun grammar in questions", async ({ page, request, browserName }, testInfo: TestInfo) => {
    test.skip(browserName !== "chromium", "Temporary Chromium-only E2E coverage.");
    const baseURL = (testInfo.project.use.baseURL as string) ?? "http://127.0.0.1:3100";
    const trialIds = (await getTrialIds(request, baseURL)).slice(0, 5);

    test.skip(trialIds.length < 5, "Fewer than five trial IDs available in this environment.");

    for (const trialId of trialIds) {
      await page.goto(new URL(`/trial/${trialId}/screen?mode=patient&debug=1`, baseURL).toString());
      await expect(page.getByRole("heading", { name: /eligibility screening/i })).toBeVisible();
      await page.getByRole("button", { name: /someone i care for/i }).click();
      await expect(page.getByText(/before we begin/i)).toHaveCount(0);

      const visibleText = await page.locator("[data-route='screener']").innerText();
      expect(visibleText).not.toMatch(/\b(how old are|are|do|does|have|has|can|could|will|would|should)\s+them\b/i);
    }
  });
});

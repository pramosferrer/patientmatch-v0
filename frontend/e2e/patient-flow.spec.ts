import { expect, test } from "@playwright/test";

test.describe("Patient flow", () => {
  test("desktop journey from landing to screener", async ({ page, request, browserName }, testInfo) => {
    test.skip(browserName !== "chromium", "Desktop journey runs on Chromium.");

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /find clinical trials that fit your life/i }),
    ).toBeVisible();
    await page.goto("/trials?condition=migraine");

    await expect(page).toHaveURL(/condition=/);

    const baseURL = testInfo.project.use.baseURL as string;
    const response = await request.get(new URL("/api/trials?page=1", baseURL).toString());
    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    const nctId = payload?.trials?.[0]?.nct_id as string | undefined;
    test.skip(!nctId, "No trial IDs available in this environment.");

    await page.goto(`/trial/${nctId}/screen?mode=patient`);
    await expect(page).toHaveURL(/\/trial\/.+\/screen/);
    await expect(page.getByRole("heading", { name: /eligibility screening/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue/i }).first()).toBeVisible();
  });

  test("mobile layout does not overflow during core flow", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Temporary Chromium-only E2E coverage.");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/trials?condition=diabetes");

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(hasHorizontalOverflow).toBe(false);

    await expect(page).toHaveURL(/\/trials\?/);
  });
});

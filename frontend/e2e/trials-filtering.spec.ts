import { expect, test } from "@playwright/test";

test.describe("Trials guided filtering", () => {
  test("applies guided intake values to URL filters", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Temporary Chromium-only E2E coverage.");
    await page.goto("/trials?intake=1");

    await expect(page.getByRole("heading", { name: /find your best-fit trials/i })).toBeVisible();

    const conditionInput = page.getByLabel("Condition");
    await conditionInput.fill("migraine");

    const nextButton = page.getByRole("button", { name: "Next", exact: true }).first();
    await expect(nextButton).toBeEnabled();
    await nextButton.click();

    await page.getByLabel("ZIP code (optional)").fill("02115");
    await nextButton.click();

    await page.getByLabel("Age (optional)").fill("42");
    await nextButton.click();

    await page.getByLabel("Female").click();
    await nextButton.click();

    await page.getByRole("button", { name: "See My Matches" }).click();

    await expect(page).toHaveURL(/\/trials\?/);
    await expect(page).toHaveURL(/condition=migraine/);
    await expect(page).toHaveURL(/zip=02115/);
    await expect(page).toHaveURL(/age=42/);
    await expect(page).toHaveURL(/sex=female/);
    await expect(page).not.toHaveURL(/intake=1/);
  });
});

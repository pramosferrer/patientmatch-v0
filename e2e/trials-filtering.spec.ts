import { expect, test } from "@playwright/test";

test.describe("Trials guided filtering", () => {
  test("applies guided intake values to URL filters", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Temporary Chromium-only E2E coverage.");
    await page.goto("/trials?intake=1");

    await expect(page.getByRole("heading", { name: /narrow this list before you open individual studies/i })).toBeVisible();
    await expect(page.getByTestId("trials-intake-stepper")).toHaveAttribute("data-hydrated", "true");

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

    await page.getByRole("button", { name: "Apply filters" }).click();

    await expect(page).toHaveURL(/\/trials\?/);
    await expect(page).toHaveURL(/condition=migraine/, { timeout: 15_000 });
    await expect(page).toHaveURL(/zip=02115/, { timeout: 15_000 });
    await expect(page).toHaveURL(/age=42/, { timeout: 15_000 });
    await expect(page).toHaveURL(/sex=female/, { timeout: 15_000 });
    await expect(page).toHaveURL(/radius=50/, { timeout: 15_000 });
    await expect(page).not.toHaveURL(/intake=1/);
  });
});

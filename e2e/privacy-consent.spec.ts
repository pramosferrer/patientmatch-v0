import { expect, test } from "@playwright/test";

test.describe("Privacy and consent flows", () => {
  test("renders privacy policy content", async ({ page }) => {
    await page.goto("/privacy");

    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
    await expect(page.getByText("Anonymous Screening")).toBeVisible();
    await expect(page.getByText("Local-First Profile")).toBeVisible();
    await expect(page.getByText(/We do not collect or send patient leads to trial sites/i)).toBeVisible();
  });

  test("lead capture endpoint is not publicly available", async ({ request }) => {
    const response = await request.post("/api/leads", { data: {} });
    expect(response.status()).toBe(404);
  });
});

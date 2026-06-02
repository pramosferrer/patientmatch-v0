import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";

const outputDir = path.resolve(process.cwd(), "docs/screens");
const baseUrl = (process.env.BASE_URL || "https://patientmatch.health").replace(/\/+$/, "");

async function saveViewport(page: Page, file: string, delayMs = 1600) {
  if (delayMs > 0) {
    await page.waitForTimeout(delayMs);
  }
  await page.screenshot({
    path: path.join(outputDir, file),
    fullPage: false,
  });
  console.log(`Saved ${file}`);
}

async function goto(page: Page, pathname: string) {
  const url = new URL(pathname, baseUrl).toString();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
}

async function fillIfPresent(page: Page, placeholder: string | RegExp, value: string) {
  const locator = page.getByPlaceholder(placeholder).first();
  if ((await locator.count()) === 0) return false;
  await locator.fill(value);
  return true;
}

async function clickIfPresent(page: Page, name: string | RegExp) {
  const locator = page.getByRole("button", { name }).first();
  if ((await locator.count()) === 0) return false;
  await locator.click();
  return true;
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });

  try {
    await goto(page, "/");
    await saveViewport(page, "01-welcome.png", 2200);

    await goto(page, "/trials");
    await saveViewport(page, "02-dob.png", 2200);

    await goto(page, "/trials?mode=intake");
    await page.waitForTimeout(2200);
    await fillIfPresent(page, /long covid/i, "Long COVID");
    await saveViewport(page, "03-sex.png", 500);

    await fillIfPresent(page, /94107/i, "94107");
    await saveViewport(page, "04-zip.png", 500);

    await clickIfPresent(page, /show my trials/i);
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await saveViewport(page, "05-travel.png", 2500);

    const firstTrialHref = await page
      .locator('a[href^="/trial/"]')
      .first()
      .getAttribute("href")
      .catch(() => null);

    if (await clickIfPresent(page, /^map$/i)) {
      await saveViewport(page, "06-modality.png", 1800);
    } else {
      await saveViewport(page, "06-modality.png", 800);
    }

    if (firstTrialHref) {
      await page.goto(new URL(firstTrialHref, baseUrl).toString(), {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await saveViewport(page, "07-treatments.png", 2600);

      const screenHref = await page
        .locator('a[href$="/screen"], a[href*="/screen?"]')
        .first()
        .getAttribute("href")
        .catch(() => null);

      if (screenHref) {
        await page.goto(new URL(screenHref, baseUrl).toString(), {
          waitUntil: "domcontentloaded",
          timeout: 45_000,
        });
        await saveViewport(page, "08-follow-up.png", 2600);
        await page.screenshot({
          path: path.join(outputDir, "09-summary.png"),
          fullPage: true,
        });
        console.log("Saved 09-summary.png");
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

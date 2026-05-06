import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const baseUrl = process.env.PATIENTMATCH_BASE_URL || 'http://localhost:3000/';
  const screenshotPath = path.resolve(__dirname, '../docs/screens/landing-home.png');

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForLoadState('networkidle');

    const heroSelectors = [
      'h1:has-text("Find clinical trials")',
      'button:has-text("Start matching")',
      'section.relative',
    ];

    let lastError: unknown = null;
    for (const selector of heroSelectors) {
      try {
        await page.waitForSelector(selector, { state: 'visible', timeout: 15000 });
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      throw lastError;
    }

    await mkdir(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Saved landing screenshot to ${screenshotPath}`);
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error('Failed to capture landing page screenshot:', error);
  process.exitCode = 1;
});

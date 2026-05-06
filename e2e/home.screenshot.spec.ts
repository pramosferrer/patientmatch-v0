import { test } from '@playwright/test';

const viewports = [
  { label: 'desktop-1440x900', width: 1440, height: 900 },
  { label: 'mobile-390x844', width: 390, height: 844 },
];

for (const viewport of viewports) {
  test(`home scroll & screenshot - ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' }));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
    await page.waitForTimeout(400);

    const screenshot = await page.screenshot({ fullPage: true });
    await test.info().attach(`home-${viewport.label}`, {
      body: screenshot,
      contentType: 'image/png',
    });

    // Hide separators to ensure text remains crisp without bands.
    await page.evaluate(() => {
      document.querySelectorAll('[data-section-band]').forEach((node) => {
        (node as HTMLElement).style.display = 'none';
      });
    });
    const bandlessScreenshot = await page.screenshot({ fullPage: true });
    await test.info().attach(`home-noband-${viewport.label}`, {
      body: bandlessScreenshot,
      contentType: 'image/png',
    });
  });
}

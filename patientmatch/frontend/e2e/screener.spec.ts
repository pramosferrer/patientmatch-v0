import { test, expect, type Page } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number };

const PRIMARY_TRIAL_PATH = '/trial/NCT04333576/screen?mode=patient&debug=1';
const SECONDARY_TRIAL_PATH = '/trial/NCT06141486/screen?mode=patient&debug=1';

const intersectionArea = (a: Box, b: Box) => {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= left || bottom <= top) return 0;
  return (right - left) * (bottom - top);
};

const ensureVisibleContrast = async (page: Page, path: string) => {
  const targetUrl = path.startsWith('http') ? path : `http://localhost:3000${path}`;
  await page.goto(targetUrl);

  const inputContainer = page.getByTestId('pm-input-container');
  const uiInput = page.getByTestId('pm-input-ui');
  const nativeInput = page.getByTestId('pm-input-native');
  const clinicHint = page.getByTestId('clinic-hint');

  await expect(inputContainer).toBeVisible();
  await expect(uiInput).toBeVisible();
  await expect(nativeInput).toBeVisible();
  await expect(clinicHint).toBeVisible();

  await nativeInput.fill('');
  await nativeInput.type('34');
  await expect(nativeInput).toHaveValue('34');

  const uiStyles = await page.$eval('[data-testid="pm-input-ui"]', (element) => {
    const computed = window.getComputedStyle(element as HTMLElement);
    return {
      opacity: computed.opacity,
      display: computed.display,
      boxShadow: computed.boxShadow,
    };
  });
  const nativeStyles = await page.$eval('[data-testid="pm-input-native"]', (element) => {
    const computed = window.getComputedStyle(element as HTMLElement);
    return {
      opacity: computed.opacity,
      display: computed.display,
      boxShadow: computed.boxShadow,
    };
  });

  expect(Number(uiStyles.opacity)).toBeGreaterThan(0);
  expect(['block', 'flex', 'inline-flex']).toContain(uiStyles.display);
  expect(uiStyles.boxShadow).not.toBe('none');

  expect(Number(nativeStyles.opacity)).toBeGreaterThan(0);
  expect(nativeStyles.boxShadow).not.toBe('none');

  const inputBox = await inputContainer.boundingBox();
  const hintBox = await clinicHint.boundingBox();
  expect(inputBox).not.toBeNull();
  expect(hintBox).not.toBeNull();
  if (!inputBox || !hintBox) {
    throw new Error('Bounding boxes unavailable for overlap assertion');
  }

  const overlap = intersectionArea(inputBox as Box, hintBox as Box);
  expect(overlap).toBeLessThanOrEqual(4);
};

test.describe('Screener clinic hint does not cover inputs', () => {
  test('age field stays visible and interactive alongside clinic banner', async ({ page }) => {
    await ensureVisibleContrast(page, PRIMARY_TRIAL_PATH);
  });

  test('patient questions render for alternate trial', async ({ page }) => {
    await ensureVisibleContrast(page, SECONDARY_TRIAL_PATH);
  });
});

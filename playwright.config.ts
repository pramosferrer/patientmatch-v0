import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3100';
const parsedBaseUrl = new URL(baseURL);
const port = parsedBaseUrl.port || (parsedBaseUrl.protocol === 'https:' ? '443' : '80');
const chromiumProject = {
  name: 'chromium',
  use: { ...devices['Desktop Chrome'] },
};

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },

  projects: process.env.CI
    ? [chromiumProject]
    : [
        chromiumProject,
        {
          name: 'firefox',
          use: { ...devices['Desktop Firefox'] },
        },
        {
          name: 'webkit',
          use: { ...devices['Desktop Safari'] },
        },
        {
          name: 'Mobile Chrome',
          use: { ...devices['Pixel 5'] },
        },
        {
          name: 'Mobile Safari',
          use: { ...devices['iPhone 12'] },
        },
      ],

  webServer: {
    command: `PORT=${port} npm run dev -- --hostname 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});

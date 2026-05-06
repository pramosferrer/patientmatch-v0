const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:3000';
const WAIT_AFTER_NAVIGATION_MS = Number(process.env.SCREENSHOT_WAIT_MS ?? 500);
const VIEWPORT = { width: 1280, height: 800 };

const pages = [
  { name: 'home', path: '/' },
  { name: 'match', path: '/match' },
  { name: 'match-wizard', path: '/match/wizard' },
  { name: 'trials', path: '/trials' },
  { name: 'trial-nct05204888-screen', path: '/trial/NCT05204888/screen' },
  { name: 'conditions', path: '/conditions' },
  { name: 'conditions-long_covid', path: '/conditions/long_covid' },
  { name: 'refer', path: '/refer' },
  { name: 'list-trial', path: '/list-trial' },
  { name: 'resources', path: '/resources' },
  { name: 'resources-how-it-works', path: '/resources/how-it-works' },
  { name: 'resources-about-clinical-trials', path: '/resources/about-clinical-trials' },
  { name: 'faq', path: '/faq' },
  { name: 'about', path: '/about' },
  { name: 'how-it-works', path: '/how-it-works' },
  { name: 'privacy', path: '/privacy' },
  { name: 'terms', path: '/terms' },
  { name: 'debug', path: '/debug' },
];

(async () => {
  const screenshotDir = path.resolve(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  page.setDefaultNavigationTimeout(60_000);

  for (const { name, path: route } of pages) {
    const url = new URL(route, BASE_URL).toString();
    const outputPath = path.join(screenshotDir, `${name}-screenshot.png`);

    try {
      console.log(`Capturing ${name} → ${url}`);
      const response = await page.goto(url, { waitUntil: 'networkidle0' });

      if (!response) {
        console.warn(`No response received for ${url}.`);
      } else if (response.status() >= 400) {
        console.warn(`Received status ${response.status()} for ${url}.`);
      }

      if (WAIT_AFTER_NAVIGATION_MS > 0) {
        await new Promise((resolve) => setTimeout(resolve, WAIT_AFTER_NAVIGATION_MS));
      }

      await page.screenshot({ path: outputPath, fullPage: true, type: 'png' });
      console.log(`Saved: ${outputPath}`);
    } catch (error) {
      console.error(`Error capturing ${name}: ${error.message}`);
    }
  }

  await browser.close();
  console.log('All screenshots complete. Files are in the "screenshots" folder.');
})();

import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";

type StepConfig = {
  file: string;
  prompt: RegExp;
  fill: (page: Page) => Promise<void>;
  advance?: (page: Page) => Promise<void>;
  screenshotDelayMs?: number;
  postFillDelayMs?: number;
};

async function ensureDirectory(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function acceptConsent(page: Page) {
  const consentButton = page.getByRole("button", {
    name: /comfortable to continue/i,
  });
  if ((await consentButton.count()) > 0) {
    await consentButton.click();
  }
}

async function captureScreenshot(
  page: Page,
  targetPath: string,
  delayMs = 120,
) {
  if (delayMs > 0) {
    await page.waitForTimeout(delayMs);
  }
  await page.screenshot({ path: targetPath, fullPage: true });
  console.log(`Saved ${targetPath}`);
}

async function answerStep(page: Page, step: StepConfig, outputDir: string) {
  await page.getByRole("heading", { name: step.prompt }).first().waitFor({
    state: "visible",
  });

  await step.fill(page);
  await captureScreenshot(
    page,
    path.join(outputDir, step.file),
    step.screenshotDelayMs,
  );
  if (step.advance) {
    await step.advance(page);
  } else if (step.postFillDelayMs) {
    await page.waitForTimeout(step.postFillDelayMs);
  }
}

function normalizeBaseUrl(input: string | undefined | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

function buildCandidateBaseUrls(): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const add = (value: string | undefined | null) => {
    const normalized = normalizeBaseUrl(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  add(process.env.BASE_URL);

  const portEnvVars = [process.env.PORT, process.env.NEXT_PUBLIC_PORT];
  for (const port of portEnvVars) {
    if (port && /^\d+$/.test(port)) {
      add(`http://localhost:${port}`);
    }
  }

  const defaultPorts = [3000, 3001, 3002, 3003, 3004, 3005];
  for (const port of defaultPorts) {
    add(`http://localhost:${port}`);
  }
  for (const port of defaultPorts) {
    add(`http://127.0.0.1:${port}`);
  }

  return candidates;
}

async function resolveBaseUrl(page: Page): Promise<string> {
  const candidates = buildCandidateBaseUrls();
  let lastError: unknown = null;

  for (const candidate of candidates) {
    const target = new URL("/match", candidate).toString();
    try {
      await page.goto(target, { waitUntil: "domcontentloaded", timeout: 5000 });
      try {
        await page.waitForLoadState("networkidle", { timeout: 5000 });
      } catch {
        /* some requests may stay open; best effort */
      }
      return candidate;
    } catch (error) {
      lastError = error;
    }
  }

  const message = [
    "Unable to reach a running PatientMatch dev server.",
    `Tried: ${candidates.join(", ")}`,
  ];
  if (lastError instanceof Error) {
    message.push(`Last error: ${lastError.message}`);
  }
  throw new Error(message.join("\n"));
}

async function main() {
  const outputDir = path.resolve(process.cwd(), "docs/screens");
  await ensureDirectory(outputDir);

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });

    await context.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    const page = await context.newPage();
    const baseUrl = await resolveBaseUrl(page);
    console.log(`Using base URL: ${baseUrl}`);
    await acceptConsent(page);

    const steps: StepConfig[] = [
      {
        file: "01-welcome.png",
        prompt: /Which condition feels most important right now\?/i,
        fill: async (currentPage) => {
          const combobox = currentPage.getByRole("combobox").first();
          await combobox.click();
          await currentPage.getByRole("option", { name: /long covid/i }).click();
        },
      },
      {
        file: "02-dob.png",
        prompt: /What age should we use for matching\?/i,
        fill: async (currentPage) => {
          await currentPage.getByRole("spinbutton").fill("45");
        },
        advance: async (currentPage) => {
          const continueButton = currentPage.getByRole("button", {
            name: /^Continue/,
          });
          await continueButton.waitFor({ state: "visible" });
          await continueButton.click();
          await currentPage.waitForTimeout(220);
        },
      },
      {
        file: "03-sex.png",
        prompt: /What is your sex\?/i,
        fill: async (currentPage) => {
          await currentPage.getByRole("button", { name: "Female" }).click();
        },
        screenshotDelayMs: 80,
        postFillDelayMs: 220,
      },
      {
        file: "04-zip.png",
        prompt: /Which ZIP code should we consider for visits\?/i,
        fill: async (currentPage) => {
          await currentPage.getByPlaceholder("e.g., 94103").fill("94103");
        },
        advance: async (currentPage) => {
          const continueButton = currentPage.getByRole("button", {
            name: /^Continue/,
          });
          await continueButton.waitFor({ state: "visible" });
          await continueButton.click();
          await currentPage.waitForTimeout(220);
        },
      },
      {
        file: "05-travel.png",
        prompt: /How far would you travel for a study visit\?/i,
        fill: async (currentPage) => {
          await currentPage
            .getByRole("button", {
              name: "Within my region (up to ~75 miles)",
            })
            .click();
        },
        screenshotDelayMs: 80,
        postFillDelayMs: 220,
      },
      {
        file: "06-modality.png",
        prompt: /Are remote or hybrid trials appealing\?/i,
        fill: async (currentPage) => {
          await currentPage
            .getByRole("button", { name: "Hybrid is fine" })
            .click();
        },
        screenshotDelayMs: 80,
        postFillDelayMs: 220,
      },
      {
        file: "07-treatments.png",
        prompt: /Any current treatments we should keep in mind\?/i,
        fill: async (currentPage) => {
          await currentPage
            .getByRole("button", { name: "No ongoing treatments right now" })
            .click();
        },
        screenshotDelayMs: 80,
        postFillDelayMs: 220,
      },
      {
        file: "08-follow-up.png",
        prompt: /How should we follow up when a trial looks promising\?/i,
        fill: async (currentPage) => {
          await currentPage
            .getByRole("button", { name: "Send me an email summary" })
            .click();
        },
        screenshotDelayMs: 80,
      },
    ];

    for (const step of steps) {
      await answerStep(page, step, outputDir);
    }

    await page
      .getByRole("heading", { level: 2, name: /All set\. Here/i })
      .waitFor({ state: "visible" });
    await captureScreenshot(
      page,
      path.join(outputDir, "09-summary.png"),
      200,
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

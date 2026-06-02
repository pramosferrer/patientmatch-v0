# Contributing to PatientMatch

Thanks for your interest in improving PatientMatch. This project is an open-source storefront for patient-facing clinical trial discovery and screening.

## Good First Contribution Areas

- Improve accessibility, keyboard navigation, and screen-reader support.
- Add or improve tests around trial links, screeners, and condition pages.
- Improve patient-facing language without making medical claims.
- Make setup, documentation, and local development easier.
- Tighten privacy and security behavior.
- Improve responsive layout issues in patient flows.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Run checks before opening a pull request:

```bash
npm run lint
npm run build
```

Run Playwright tests when changing patient-facing flows:

```bash
npm run test:e2e
```

## Pull Request Guidelines

- Keep changes focused and explain the patient or maintainer problem being solved.
- Include screenshots for visible UI changes.
- Include tests for behavioral changes when practical.
- Do not add service-role usage to storefront runtime paths.
- Do not add ingestion, parsing, or registry-refresh logic to this repo without a documented serving-contract update.
- Do not log screener answers, ZIP codes, condition history, contact details, or other sensitive personal data.

## Medical and Product Guardrails

- PatientMatch does not provide medical advice.
- Avoid language that guarantees eligibility, enrollment, treatment benefit, travel support, compensation, or remote participation unless that data is explicitly available.
- Prefer patient-readable explanations and links to official ClinicalTrials.gov listings.

## Reporting Issues

Please do not include personal health information in GitHub issues. If an issue requires sensitive context, use the private security contact in `SECURITY.md`.

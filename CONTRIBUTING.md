# Contributing to PatientMatch

Thanks for your interest in improving PatientMatch. This project is an open-source storefront for patient-facing clinical trial discovery and screening.

## Good First Contribution Areas

- Improve accessibility, keyboard navigation, and screen-reader support.
- Add or improve tests around trial links, screeners, and condition pages.
- Improve patient-facing language without making medical claims.
- Make setup, documentation, and local development easier.
- Tighten privacy and security behavior.
- Improve responsive layout issues in patient flows.

Concrete starter tasks:

- Improve keyboard navigation in the trial screener.
- Add tests for PMQ adapter edge cases.
- Improve empty-state copy on trial search results.
- Add synthetic questionnaire fixtures for common eligibility patterns.
- Improve screen-reader labels on trial filters and saved-trial controls.
- Document local Supabase setup using `fixtures/demo/seed.sql`.

## Before You Start

- Read `README.md`, `SECURITY.md`, and `CODE_OF_CONDUCT.md`.
- Use synthetic examples in issues, tests, screenshots, and pull requests.
- Keep the storefront focused on public trial discovery, patient-facing UI, and Supabase anon-read serving data.

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
- Do not include real patient examples in screenshots, fixtures, test data, or issue comments.

## Medical and Product Guardrails

- PatientMatch does not provide medical advice.
- Avoid language that guarantees eligibility, enrollment, treatment benefit, travel support, compensation, or remote participation unless that data is explicitly available.
- Prefer patient-readable explanations and links to official ClinicalTrials.gov listings.

## Labels

Maintainers use labels such as `accessibility`, `privacy`, `documentation`, `patient-ux`, `questionnaire-rendering`, and `serving-contract` to route work. The label definitions live in `.github/labels.yml`.

## Reporting Issues

Please do not include personal health information in GitHub issues. If an issue requires sensitive context, use the private security contact in `SECURITY.md`.

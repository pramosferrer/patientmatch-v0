# Privacy Model

PatientMatch is healthcare-adjacent software. Even when the underlying trial data is public, profile fields and screener answers can be sensitive.

## Principles

- Do not log personal health information or sensitive profile fields.
- Do not expose service-role credentials in storefront runtime code.
- Use anon Supabase credentials in browser code.
- Use user-scoped RLS for authenticated profile or saved-trial writes.
- Use synthetic data in public issues, screenshots, tests, and fixtures.

## Sensitive Fields

Treat the following as sensitive:

- Contact details.
- ZIP codes or precise location.
- Diagnoses and condition history.
- Screener answers.
- Age, sex at birth, pregnancy status, treatment history, lab values, and related clinical profile fields.

## Storefront Data Flow

The match profile is used to reduce repeated questions and personalize trial discovery. It should remain the single source of truth for global intake fields.

Trial-specific screeners should receive only the information needed to render and evaluate the current flow. Production code should avoid console logging profile keys, screener answers, or raw questionnaire-derived clinical criteria.

## Public Contribution Rules

GitHub issues and pull requests must use synthetic examples only. Security and privacy issues should be reported privately through `SECURITY.md`.

## Dependency Security

Run:

```bash
npm audit --audit-level=high
```

The project currently avoids force-applying dependency changes that would downgrade Next.js or otherwise introduce a larger compatibility risk. Moderate transitive advisories should be tracked and resolved through compatible upstream releases.

# Security Policy

PatientMatch handles patient-facing clinical trial discovery flows, so privacy and security issues matter even when the application uses public trial data.

## Reporting a Vulnerability

Please do not report vulnerabilities or sensitive personal data in public GitHub issues.

Send security reports to:

security@patientmatch.health

Include:

- A concise description of the issue.
- Steps to reproduce.
- Impact and affected routes or files.
- Any suggested mitigation.

Please avoid including real patient names, contact details, ZIP codes, diagnoses, screener answers, or other personal health information.

## Scope

In scope:

- Exposure of secrets or credentials.
- Accidental logging or disclosure of sensitive patient/profile data.
- Authentication or authorization issues.
- Unsafe Supabase access patterns.
- Cross-site scripting or injection vulnerabilities.
- Privacy regressions in patient intake, trial matching, or screeners.

Out of scope:

- Public ClinicalTrials.gov data accuracy issues.
- Trial eligibility decisions made by study teams.
- Vulnerabilities that require access to private infrastructure not represented in this repository.

## Storefront Security Principles

- Browser clients use anon Supabase credentials only.
- Storefront runtime paths should not require `SUPABASE_SERVICE_ROLE_KEY`.
- Sensitive profile fields and screener answers should not be logged.
- Public issues and test fixtures must not contain real patient data.
- Secrets must not be placed in `NEXT_PUBLIC_*` variables.

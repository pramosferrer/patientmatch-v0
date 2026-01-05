# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a monorepo containing two distinct projects:

1. **patientmatch/** - Next.js storefront (patient-facing clinical trial matching platform)
2. **ct_project/** - Python data pipeline (AACT ingestion, DuckDB processing, questionnaire generation)

These projects share a single Supabase database: `ct_project` writes trial data; `patientmatch` reads and serves it.

## Common Commands

### PatientMatch Frontend (Next.js)

```bash
# Development
cd patientmatch/frontend
npm run dev                    # Start dev server at localhost:3000
npm run build                  # Production build
npm run lint                   # Run ESLint

# Testing
npm run test:e2e               # Run Playwright E2E tests
npm run test:e2e:ui            # Run E2E tests in UI mode
npm run test:e2e:headed        # Run E2E tests in headed mode

# Root-level scripts (from patientmatch/)
npm run dev:branch             # Branch-specific dev workflow
npm run ship                   # Production deployment workflow
npm run shot:home              # Capture homepage screenshot
```

### CT Project Pipeline (Python)

```bash
cd ct_project

# Environment setup
python -m venv .venv
source .venv/bin/activate      # On Windows: .venv\Scripts\activate
pip install -r requirements.txt  # (if exists - check for setup)

# Testing
pytest                         # Run all tests
pytest tests/test_pmq_*.py     # Run specific PMQ tests

# Build pipeline (DuckDB)
duckdb aact_raw.duckdb < sql/refresh.sql  # Build ref -> bronze -> silver -> gold

# Questionnaire generation
python scripts/build_pm_questionnaires.py --pipeline_version pmq_v19_answerability_trim_2025_12_24

# Push to Supabase
python scripts/push_to_supabase.py \
  --build_tag pmq_v19_answerability_trim_2025_12_24 \
  --mode permissive \
  --limit 0
```

## Architecture Overview

### Data Flow
```
AACT/CT.gov → ct_project (DuckDB) → Supabase (public.trials, trial_sites) → patientmatch (Next.js)
```

### PatientMatch Frontend

**Stack**: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, Supabase

**Key Directories**:
- `frontend/app/` - Next.js App Router pages and layouts
- `frontend/components/` - React components (shadcn/ui-based)
- `frontend/lib/` - Core business logic (matching, scoring, geo, auth)
- `frontend/shared/` - Shared utilities (profile cookies, conditions, geo)
- `frontend/hooks/` - Custom React hooks
- `supabase/migrations/` - Database schema migrations

**Core Modules**:
- `lib/matchEngine.ts` - Trial matching and scoring logic
- `lib/matching/evaluator.ts` - Patient-trial eligibility evaluation
- `lib/pmqAdapter.ts` - Converts questionnaire_json to UI questions
- `shared/profileCookie.ts` - Encrypted patient profile management (JWE)
- `lib/supabaseClient.ts` / `supabaseServer.ts` - Supabase clients (browser/server)

**Profile Management**: Patient data (age, sex, zip, conditions) is stored in an encrypted `pm_profile` cookie using JWE (jose library). The profile is the single source of truth for matching. See `shared/profileCookie.ts` and `app/actions.ts`.

**Matching Flow**:
1. User completes global intake (age, sex, zip, conditions) → stored in encrypted cookie
2. `/trials` page fetches trials from Supabase, calculates distance via `nearest_sites_with_meta` RPC
3. `/trial/[nct_id]/screen` loads trial-specific questionnaire, filters out global questions (dedupe), renders screener
4. Evaluation uses `questionnaire_json` (PMQ format) to determine eligibility

**Geospatial**: Distance calculated using `public.trial_sites` (lat/lon) and `public.zip_centroids`. Uses Haversine formula in `lib/geo.ts`.

### CT Project Pipeline

**Stack**: Python, DuckDB, pytest

**Key Directories**:
- `pmq/` - PMQ (Patient Matching Questionnaire) generation module
  - `eligibility_parser.py` - Parses eligibility text into sections/bullets
  - `atoms.py` - Extracts eligibility atoms (structured criteria)
  - `rules.py` - Rule-based criteria extraction
  - `generator.py` - Generates questionnaire_json from criteria
  - `question_bank.py` - Question templates and validation
- `sql/` - DuckDB SQL pipeline (refresh.sql builds ref → bronze → silver → gold)
- `scripts/` - Build and push scripts
  - `build_pm_questionnaires.py` - Generate questionnaires for all trials
  - `build_pm_trial_insights.py` - Generate trial insights (strictness, burden, etc.)
  - `push_to_supabase.py` - Upsert trials/sites/insights to Supabase
- `tests/` - pytest tests for PMQ generation

**Pipeline Stages**:
1. **Ref**: Reference tables (status_map, geonames)
2. **Bronze**: Raw AACT data ingestion
3. **Silver**: Cleaned eligibility text, parsed atoms
4. **Gold**: Final trial marts (pm_trials, pm_questionnaires, pm_trial_insights)
5. **Push**: Upsert to Supabase public tables

**Deterministic Questionnaire Generation**: No LLMs. PMQ generation uses rule-based parsing + structured fields. See `PATIENTMATCH_CONTRACT.md` for full schema.

## Important Constraints

### PatientMatch Frontend
- **DO NOT** add ingestion/parsing logic to this repo (lives in ct_project)
- **DO NOT** use `criteria_json` field (deprecated; use `questionnaire_json`)
- **DO NOT** log PII/PHI (age, zip, conditions, screener answers)
- **DO NOT** expose service-role keys in client code (no secrets in `NEXT_PUBLIC_*`)
- **DO** use the Direct Injection pattern: `questionnaire_json` → `pmqAdapter.ts` → `UiQuestion[]`
- **DO** dedupe global profile questions (age, sex, zip, diagnosis) from trial screeners
- **DO** treat Supabase as read-only serving layer (writes happen in ct_project)

### CT Project Pipeline
- **DO** maintain deterministic questionnaire generation (no LLM calls)
- **DO** keep `pipeline_version` in sync with `build_tag` when pushing to Supabase
- **DO** run question bank lints when updating question keys or rules
- **DO** use `gold.pm_trial_criteria_norm` view (criteria_json is wrapped)

## Key Supabase Tables

### public.trials
- `nct_id` (PK) - ClinicalTrials.gov identifier
- `questionnaire_json` (jsonb) - PMQ v10+ payload (source of truth)
- `title`, `sponsor`, `phase`, `status`, `conditions` (text[])
- `minimum_age`, `maximum_age`, `gender`
- `quality_score`, `quality_flags`, `readiness` (bool)
- `build_tag` - pipeline version string

### public.trial_sites
- `(nct_id, site_key)` (PK)
- `facility_name`, `city`, `state_code`, `zip5`
- `lat`, `lon`, `geom` (PostGIS geography)

### public.trial_insights
- `nct_id` (PK)
- `strictness_score`, `burden_score`, `novelty_score`, `logistics_score`
- `top_disqualifiers_json`, `insights_flags_json`, `plain_summary_json`

### public.zip_centroids
- `zip` (PK), `lat`, `lon`, `state_code`

## Testing

**Frontend**: Playwright E2E tests in `patientmatch/e2e/` and `patientmatch/frontend/e2e/`. Run with `npm run test:e2e` from frontend directory.

**Backend**: pytest tests in `ct_project/tests/`. Focus on PMQ atom extraction, rule application, and questionnaire generation logic.

## Environment Variables

See `.env.example` files in each project. Key variables:

**PatientMatch**:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Browser-safe
- `SUPABASE_SERVICE_ROLE_KEY` - Server-only (Next.js route handlers)
- `PII_SECRET` - Required for profile cookie encryption (≥32 chars)

**CT Project**:
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` - For pushing data
- `DATABASE_URL` - Postgres connection string (if using Postgres directly)
- `OPENAI_API_KEY` - Optional (not used in deterministic pipeline)

## Node/npm Requirements

Both projects require:
- Node.js ≥20.11.0 <21
- npm ≥10.2.0

See `engines` field in package.json files for enforcement.

## Additional Documentation

- `patientmatch/PROJECT_OVERVIEW.md` - High-level storefront architecture
- `patientmatch/AGENTS.md` - Strict coding policies for automated changes
- `ct_project/PATIENTMATCH_CONTRACT.md` - Full schema and data contract
- `patientmatch/.cursorrules` - Context for coding assistants

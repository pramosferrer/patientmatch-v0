PatientMatch — Context Pack (Generated 2025-10-19 21:53)
2025-10-19 21:53
PatientMatch pairs patients with actively recruiting clinical trials through a guided intake, Supabase-backed matching engine, and screener-to-lead funnel that emphasizes privacy and consent (frontend/components/marketing/Hero.tsx:24-78; frontend/app/match/MatchPageClient.tsx:112-760; frontend/components/Screener.tsx:1-220; frontend/app/api/leads/route.ts:24-114).

## Table of Contents
- [System at a Glance](#system-at-a-glance)
- [User Journey & Screens](#user-journey--screens)
- [Matching & Screener Logic](#matching--screener-logic)
- [APIs & Server Boundaries](#apis--server-boundaries)
- [Database & Schema Highlights](#database--schema-highlights)
- [Data Ingestion Engine](#data-ingestion-engine)
- [Styling & Design System](#styling--design-system)
- [Security, Privacy, & Performance Notes](#security-privacy--performance-notes)
- [Run Local & Deploy](#run-local--deploy)
- [Known Risks & Quick Wins](#known-risks--quick-wins)
- [Appendix — File Inventory & Versions](#appendix--file-inventory--versions)
- [Change Log Source](#change-log-source)

## System at a Glance
- `frontend/` — Next.js App Router UI, client/server components, and in-repo API handlers powering the patient experience (frontend/app/page.tsx:1-26; frontend/app/api/match/route.ts:1-198; frontend/components/marketing/Hero.tsx:1-78).
- `data_engine/` — CT.gov ingestion, LLM extraction, and Supabase upserts that maintain trials metadata and `criteria_json` (data_engine/parse_trial.py:1-210; data_engine/backfill_missing_trials.py:1-168; data_engine/supabase_writer.py:1-118).
- `api/` — FastAPI prototype retaining a legacy matching endpoint and SQLAlchemy lead persistence outside the Next.js stack (api/app/main.py:1-160; api/app/database.py:1-60; api/app/models.py:1-20).
- Canonical database schema lives in `schema.sql`, defining extensions, trial tables, geospatial helpers, and RLS policies enforced in Supabase (schema.sql:40-1158).
- Frontend stack: Next.js ^15.5.2, React 19.1.0, Tailwindcss ^3.4.17, Framer Motion ^12.23.12, lucide-react ^0.536.0, @supabase/supabase-js ^2.53.0, tailwindcss-animate ^1.0.7 (frontend/package.json:15-55) with shadcn/ui configured for RSC support (frontend/components.json:1-12).
- Data engine dependencies include httpx>=0.28,<0.29, tenacity==8.5.0, pydantic==2.10.4, supabase>=2.7.3,<3, openai>=1.55.3 (data_engine/requirements.txt:1-10).
- FastAPI proto dependencies pin fastapi==0.104.1, uvicorn==0.24.0, sqlalchemy==2.0.23, supabase-py==2.3.0 (api/requirements.txt:1-9).
- Tooling notes: Node.js engine is not declared in repository manifests (frontend/package.json:1-58; package.json:1-13), and Python runtime version is likewise unspecified beyond requirements (data_engine/requirements.txt:1-13; api/requirements.txt:1-9).

## User Journey & Screens
- End-to-end flow proceeds from intake to prefilter preview to Supabase-backed matches, trial detail, screener, and lead capture (frontend/app/match/MatchPageClient.tsx:112-760; frontend/app/api/prefilter/route.js:1-210; frontend/app/trials/page.tsx:1-440; frontend/app/trial/[nct_id]/screen/page.tsx:1-210; frontend/components/ScreenResult.tsx:1-200).
- Match wizard supports step-by-step intake, zip geocoding, and device location fallbacks while persisting partial profiles (frontend/app/match/wizard/MatchWizard.tsx:1-200; frontend/shared/profileCookie.ts:1-120).
- Trials index renders prefilled matches, lazy compare drawer, and nearest-site augmentation with server-side Supabase queries (frontend/app/trials/page.tsx:1-440; frontend/lib/trials/nearestSites.ts:1-118).
- Trial screening page loads `criteria_json`, merges profile cookie answers, and mounts the dynamic screener experience (frontend/app/trial/[nct_id]/screen/page.tsx:1-210; frontend/components/Screener.tsx:1-220).
- Route map: `/` landing (frontend/app/page.tsx:1-26); `/match` intake (frontend/app/match/page.tsx:1-12); `/match/wizard` advanced flow (frontend/app/match/wizard/MatchWizard.tsx:1-200); `/trials` results (frontend/app/trials/page.tsx:1-440); `/trial/[nct_id]` detail and `/trial/[nct_id]/screen` screener (frontend/app/trial/[nct_id]/screen/page.tsx:1-210); `/conditions` browse (frontend/app/conditions/page.tsx:1-40); `/refer` physician referral (frontend/app/refer/page.tsx:1-40); `/list-trial` sponsor intake (frontend/app/list-trial/page.tsx:1-60); `/resources/*` education (frontend/app/resources/page.tsx:1-80); `/debug` environment health (frontend/app/debug/page.tsx:1-120).
- State persistence combines localStorage for wizard progress, saved trials, and nearby summaries with encrypted cookies for profile data (frontend/app/match/MatchPageClient.tsx:635-690; frontend/lib/trials/savedTrialsStore.ts:1-120; frontend/app/conditions/ConditionsClient.tsx:90-160; frontend/shared/profileCookie.ts:1-120).

## Matching & Screener Logic
- Trial screeners consume the stored `criteria_json`, adapt clauses to patient-friendly questions, and normalize them into primary vs clinic-only tasks (frontend/app/trial/[nct_id]/screen/page.tsx:70-186; frontend/lib/criteria/adapter.ts:1-140; frontend/lib/criteria/normalize.ts:1-200; frontend/components/ScreenResult.tsx:1-200).
- `evaluateCriteria` flattens clauses, derives hard exclusions, unknowns, and reasons to drive eligibility scoring downstream (frontend/shared/match/evaluate.ts:1-200).
- `matchTrials` normalizes patient conditions, resolves nearest sites, filters by distance/modality, and combines eligibility, logistics, and priority scores (frontend/shared/match/index.ts:432-620; frontend/app/lib/matching/score.ts:1-200).
- Prefilter endpoint returns illustrative matches while the main match route enforces rate limits, validates the profile schema, and streams Supabase-powered results (frontend/app/api/prefilter/route.js:1-210; frontend/app/api/match/route.ts:1-198; frontend/lib/schemas/patientProfile.ts:1-80).
- Feature flags and shared secrets guard match-adjacent behaviors: `FEATURE_ALLOW_WRITES` governs analytics and lead inserts while `REVALIDATE_SECRET` protects ISR hooks (frontend/app/api/leads/route.ts:24-48; frontend/app/api/analytics/route.js:24-80; frontend/app/api/revalidate/conditions/route.ts:5-48).
- Match request flow: rate-limit and validate intake (frontend/app/api/match/route.ts:24-66); build match profile with normalized radius and remote preferences (frontend/app/api/match/route.ts:100-154); load nearest-site metadata (frontend/shared/match/index.ts:486-508); score eligibility/logistics/priority (frontend/shared/match/index.ts:563-618); respond with totals, warnings, and optional debug payloads (frontend/app/api/match/route.ts:166-194).

## APIs & Server Boundaries
- Read-oriented Next.js routes cover trials search, match execution, evaluation summaries, profile extraction, and geo lookup without service-role credentials (frontend/app/api/trials/route.ts:1-200; frontend/app/api/match/route.ts:1-198; frontend/app/api/evaluate/route.js:1-120; frontend/app/api/extract_profile/route.js:1-120; frontend/app/api/geo/zip-to-latlon/route.ts:1-120).
- Write-capable endpoints require the service client and `FEATURE_ALLOW_WRITES` before touching Supabase tables: leads, referrals, trial submissions, analytics, user data merges, and digest cron (frontend/app/api/leads/route.ts:24-114; frontend/app/api/refer/route.ts:16-72; frontend/app/api/list-trial/route.ts:22-94; frontend/app/api/analytics/route.js:24-90; frontend/app/api/user/data/route.ts:52-82; frontend/app/api/user/merge-guest/route.ts:20-60; frontend/app/api/cron/digest/route.ts:1-220).
- Profile persistence relies on a same-origin `POST /api/profile/save` that writes an encrypted cookie via `setProfileCookie` (frontend/app/api/profile/save/route.ts:1-120; frontend/shared/profileCookie.ts:1-120).
- Supabase client boundaries: browser anon client for RSC-savvy components (frontend/lib/supabaseClient.ts:1-24), server anon client for API routes and SSR (frontend/lib/supabaseServer.ts:1-24), and service-role admin locked to server handlers (frontend/lib/supabaseAdmin.ts:1-24).
- The FastAPI prototype exposes `/match` with SQLAlchemy-backed lead persistence but remains separate from production routing (api/app/main.py:1-160; api/app/models.py:1-20).

## Database & Schema Highlights
- Core tables include `trials` with `criteria_json`, `condition_slugs`, and publish flags; `sites` with PostGIS geography; and intake tables `patient_leads`, `physician_referrals`, `trial_submissions`, and `events` (schema.sql:382-520; schema.sql:430-520).
- Public views (`trials_display`, `trials_public`, `trials_quality`) present curated slices for UI consumption with normalized descriptions and quality flags (schema.sql:456-540).
- Geospatial helpers `nearest_sites` and `nearest_sites_with_meta` expose distance-calculated RPCs consumed by matching flows (schema.sql:61-122; frontend/lib/trials/nearestSites.ts:1-118).
- Performance indexes cover `condition_slugs`, `criteria_json`, `visit_model`, location GISTs, and per-table tracking to support matching queries (schema.sql:930-998).
- RLS posture denies public access to lead/referral/submission tables while enabling policy-scoped reads for user profiles and digest logs (schema.sql:1100-1158).
- ⚠️ Conflict noted: the Next.js lead insert writes encrypted `pii_full_name`/`pii_email`/`pii_phone`, but `patient_leads` in `schema.sql` still exposes plaintext `full_name`/`email`/`phone` columns; reconcile before enabling writes (frontend/app/api/leads/route.ts:86-96; schema.sql:382-389).

## Data Ingestion Engine
- `CtgovClient` fetches study metadata with retryable httpx calls, configurable timeouts, and 429/5xx backoff (data_engine/ctgov_client.py:1-120).
- `parse_trial` orchestrates eligibility extraction, condition normalization, OpenAI-assisted parsing, and criteria caching under env-driven knobs like `ALLOW_EMPTY_CRITERIA`, `DISABLE_LLM`, and `MIN_CRITERIA_THRESHOLD` (data_engine/parse_trial.py:1-120).
- `backfill_missing_trials.py` coordinates preflight metadata screening vs LLM extraction with budget controls, concurrency tuning, and resumable queues; invoke via `python backfill_missing_trials.py --limit 500 --sample 50` during targeted refreshes (data_engine/backfill_missing_trials.py:1-170).
- Supabase writes use REST upserts with conflict resolution, hashing guards, and retry logic to merge trial metadata (`Prefer: resolution=merge-duplicates`) (data_engine/supabase_writer.py:1-118).
- Failure handling logs per-stage counters, requeues 429s, and halts on spend ceilings to protect LLM budgets (data_engine/backfill_missing_trials.py:92-168).

## Styling & Design System
- Tailwind config defines class safelists, PM-branded color tokens, aurora animations, and container sizing to align UI primitives (frontend/tailwind.config.js:1-160).
- Global CSS seeds semantic color variables, typography mixins, and aurora backgrounds to keep marketing and product screens consistent (frontend/app/globals.css:1-220).
- `AuroraBG` renders animated gradients with adjustable intensity and blur, reused across hero surfaces and screener shells (frontend/components/AuroraBG.tsx:1-78).
- Marketing hero and CTA components lean on shadcn ui primitives and Tailwind tokens for responsive layouts (frontend/components/marketing/Hero.tsx:1-120; frontend/components/marketing/HeroTrialPreview.tsx:1-160).

## Security, Privacy, & Performance Notes
- Runtime headers enforce CSP, HSTS, X-Frame-Options, and restrictive Permissions-Policy while allowing Supabase websocket connections in dev (frontend/next.config.mjs:1-44).
- `PII_SECRET` must be ≥32 chars to enable AES-GCM encryption for leads and profile cookies; requests fail fast if misconfigured (frontend/app/api/leads/route.ts:16-48; frontend/shared/profileCookie.ts:23-60).
- `FEATURE_ALLOW_WRITES` gates every service-role insert, and `REVALIDATE_SECRET` protects ISR refresh endpoints with a dev fallback (frontend/app/api/leads/route.ts:24-48; frontend/app/api/refer/route.ts:18-42; frontend/app/api/revalidate/conditions/route.ts:5-48).
- Rate limiting uses Upstash Redis when credentials exist and falls back to an in-memory bucket with logged warnings in dev (frontend/lib/rateLimitStore.ts:1-120).
- Matching performance considerations: max 150 trials fetched per request, nearest-site cache with TTL, and detailed scoring loops—monitor Supabase response size logged in non-prod (frontend/shared/match/index.ts:463-620; frontend/lib/trials/nearestSites.ts:1-118; frontend/app/api/match/route.ts:181-194).
- Debug surfaces (`/debug`) and analytics logging should stay behind controlled environments and redact PII; analytics writes remain best-effort and console log events (frontend/app/debug/page.tsx:1-120; frontend/app/api/analytics/route.js:57-86).

## Run Local & Deploy
- Frontend dev loop: `npm run dev` for Next.js, plus lint/build/test scripts for CI parity (frontend/package.json:5-13).
- Data engine exercises run via `python backfill_missing_trials.py --limit 100` or other CLI flags after installing requirements (data_engine/backfill_missing_trials.py:137-168; data_engine/requirements.txt:1-10).
- FastAPI prototype can be served with `uvicorn app.main:app --reload` using dependencies in `api/requirements.txt` (api/app/main.py:1-160; api/requirements.txt:1-9).
- Required env vars include Supabase URL/keys, `PII_SECRET`, `FEATURE_ALLOW_WRITES`, Upstash Redis tokens, Resend credentials, and optional cron secrets referenced throughout route handlers (frontend/lib/supabaseServer.ts:1-24; frontend/app/api/leads/route.ts:16-48; frontend/lib/rateLimitStore.ts:43-104; frontend/app/api/cron/digest/route.ts:1-60).
- Health and smoke checks: `/debug` validates Supabase access, `/match?debug=1` logs payload sizes, and Supabase RPCs for nearest sites confirm PostGIS availability (frontend/app/debug/page.tsx:1-120; frontend/app/api/match/route.ts:181-194; frontend/lib/trials/nearestSites.ts:1-118).

## Known Risks & Quick Wins
- Align the `patient_leads` table with encrypted column names before toggling writes to avoid runtime insert failures (frontend/app/api/leads/route.ts:86-98; schema.sql:382-389).
- Promote the Upstash-backed rate limiter to production defaults; the in-memory fallback is not durable or distributed (frontend/lib/rateLimitStore.ts:43-118).
- Replace the placeholder-driven `/api/prefilter` response with real Supabase data to prevent mismatched expectations (frontend/app/api/prefilter/route.js:21-175).
- Remove or guard analytics console logs now that events may run in production contexts (frontend/app/api/analytics/route.js:57-86).
- Deduplicate `python-dotenv` pins in the data engine requirements to simplify dependency management (data_engine/requirements.txt:4-12).

## Appendix — File Inventory & Versions
- Frontend packages: Next.js ^15.5.2, React 19.1.0, Tailwindcss ^3.4.17, Framer Motion ^12.23.12, lucide-react ^0.536.0, @supabase/supabase-js ^2.53.0 (frontend/package.json:15-45).
- UI configuration: shadcn/ui schema with Tailwind aliases and RSC enabled (frontend/components.json:1-12).
- Tooling: Typescript ^5.6.3, ESLint ^9, Playwright ^1.40.0 in frontend; Playwright ^1.56.0 and tsx ^4.20.6 at repo root (frontend/package.json:47-55; package.json:2-13).
- Data engine deps: httpx>=0.28,<0.29, tenacity==8.5.0, pydantic==2.10.4, supabase>=2.7.3,<3, openai>=1.55.3 (data_engine/requirements.txt:1-10).
- FastAPI deps: fastapi==0.104.1, uvicorn==0.24.0, sqlalchemy==2.0.23, supabase-py==2.3.0 (api/requirements.txt:1-9).
- Engine pins: Node version not declared (frontend/package.json:1-58; package.json:1-13); Python version not pinned beyond requirements (data_engine/requirements.txt:1-13; api/requirements.txt:1-9).
- Key recent files: frontend/app/api/match/route.ts — 2025-10-19 13:57; frontend/shared/match/index.ts — 2025-10-19 14:00; schema.sql — 2025-10-19 21:42 (stat listing in Change Log Source).

## Change Log Source
- frontend/app/layout.tsx — 2025-10-19 19:16
- frontend/app/page.tsx — 2025-10-11 17:20
- frontend/app/globals.css — 2025-10-11 20:15
- frontend/components/marketing/Hero.tsx — 2025-10-11 20:27
- frontend/components/AuroraBG.tsx — 2025-10-11 17:15
- frontend/app/trial/[nct_id]/screen/page.tsx — 2025-10-19 20:55
- frontend/components/Screener.tsx — 2025-10-19 21:30
- frontend/app/api/match/route.ts — 2025-10-19 13:57
- frontend/app/api/prefilter/route.js — 2025-10-19 13:37
- frontend/shared/match/index.ts — 2025-10-19 14:00
- frontend/app/lib/matching/score.ts — 2025-10-19 14:04
- frontend/shared/match/evaluate.ts — 2025-10-19 13:55
- frontend/lib/schemas/patientProfile.ts — 2025-10-08 01:02
- frontend/lib/criteria/adapter.ts — 2025-10-19 17:30
- frontend/lib/criteria/normalize.ts — 2025-10-19 20:33
- frontend/lib/analytics.ts — 2025-10-19 15:29
- frontend/lib/rateLimitStore.ts — 2025-10-10 00:24
- frontend/lib/supabaseClient.ts — 2025-08-11 23:21
- frontend/lib/supabaseServer.ts — 2025-09-04 01:11
- frontend/lib/supabaseAdmin.ts — 2025-09-07 15:54
- frontend/app/api/leads/route.ts — 2025-10-10 18:50
- frontend/app/api/refer/route.ts — 2025-09-07 15:55
- frontend/app/api/list-trial/route.ts — 2025-09-07 15:55
- frontend/app/api/analytics/route.js — 2025-10-10 18:50
- frontend/app/api/profile/save/route.ts — 2025-10-19 18:40
- frontend/shared/profileCookie.ts — 2025-10-19 18:40
- frontend/app/api/geo/zip-to-latlon/route.ts — 2025-10-19 13:20
- frontend/app/api/trials/route.ts — 2025-10-19 13:21
- frontend/app/trials/page.tsx — 2025-10-19 13:35
- frontend/lib/trials/nearestSites.ts — 2025-10-11 20:17
- frontend/shared/geo.ts — 2025-10-19 14:05
- frontend/app/api/revalidate/conditions/route.ts — 2025-09-09 00:21
- frontend/tailwind.config.js — 2025-10-11 17:14
- frontend/components.json — 2025-08-07 00:07
- frontend/next.config.mjs — 2025-09-08 01:35
- frontend/package.json — 2025-10-19 19:33
- package.json — 2025-10-10 16:19
- data_engine/parse_trial.py — 2025-09-08 19:57
- data_engine/ctgov_client.py — 2025-09-08 12:58
- data_engine/supabase_writer.py — 2025-09-08 23:48
- data_engine/requirements.txt — 2025-10-07 23:13
- api/app/main.py — 2025-09-07 16:33
- api/app/database.py — 2025-08-07 10:32
- api/app/models.py — 2025-08-07 10:32
- api/requirements.txt — 2025-09-07 18:23
- schema.sql — 2025-10-19 21:42

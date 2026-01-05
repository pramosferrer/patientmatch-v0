# PatientMatch Agent Discovery — 2025-10-07 21:41:36Z

| Area | Highlights | Key Evidence |
| --- | --- | --- |
| Stack scope | Next.js App Router + Supabase + Python data engine | `PROJECT_OVERVIEW.md:4`, `frontend/package.json:1`, `data_engine/requirements.txt:1` |
| Data touchpoints | Writes hit `patient_leads`, `trial_submissions`, `physician_referrals`, `events` behind `FEATURE_ALLOW_WRITES` | `frontend/app/api/leads/route.ts:34`, `frontend/app/api/list-trial/route.ts:41`, `frontend/app/api/refer/route.ts:22`, `frontend/app/api/analytics/route.js:6` |
| Matching flow | Prefilter → match API → screener adapts `criteria_json` | `frontend/app/api/prefilter/route.js:1`, `frontend/app/api/match/route.ts:1`, `frontend/components/Screener.tsx:1` |
| Governance | CSP + security headers; API rate limiting uses shared Upstash bucket with in-memory dev fallback | `frontend/next.config.mjs:1`, `frontend/lib/rateLimitStore.ts:1` |
| Testing & CI | Targeted unit tests + Playwright + Lighthouse CI | `frontend/lib/matchEngine.test.ts:1`, `e2e/trials.spec.ts:1`, `.github/workflows/lighthouse.yml:1` |

## 1) Repo & Stack Inventory
- **Storefront layout**: Frontend (`frontend/`), e2e tests (`e2e/`), scripts (`scripts/`), docs (`docs/`).
- **Frameworks & languages**: Next.js App Router with TypeScript (`frontend/package.json`).
- **Data Source**: Supabase (Postgres) serving tables. Data pipeline is external (`ct_project`).
- **Runtime entry points**: Next layout at `frontend/app/layout.tsx` and root page `frontend/app/page.tsx`; Next API handlers under `frontend/app/api/*/route.*`.

## 2) Frontend (Next.js) Anatomy
- **App Router routes**: Key pages include `app/page.tsx`, `app/match/wizard/page.tsx`, `app/trials/page.tsx`, `app/trial/[nct_id]/screen/page.tsx`, `app/conditions/[slug]/page.tsx`, `app/about/page.tsx`, `app/refer/page.tsx`, `app/list-trial/page.tsx`, `app/resources/**/*/page.tsx`, `app/how-it-works/page.tsx`, `app/faq/page.tsx`, `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/debug/page.tsx`. Evidence: `rg --files -g 'page.tsx' app`.
- **API route handlers**: 
  - `app/api/trials/route.ts` (`GET`) paginates `trials`.
  - `app/api/match/route.ts` (`POST`, `GET` 405) scores matches.
  - `app/api/prefilter/route.js`, `app/api/evaluate/route.js`, `app/api/extract_profile/route.js` (`POST`) use rate limiting.
  - `app/api/leads/route.ts`, `app/api/refer/route.ts`, `app/api/list-trial/route.ts` (`POST`) gated by `FEATURE_ALLOW_WRITES`.
  - `app/api/analytics/route.js` (`POST`) logs best-effort events.
  - `app/api/conditions/route.ts` (`GET` catalog, `POST` revalidate) + `app/api/revalidate/route.ts` and nested `revalidate/conditions/route.ts`.
- **Component libraries**: Tailwind tokens and safelist in `frontend/tailwind.config.js:1`; shadcn aliases via `frontend/components.json:1`; Radix primitives in `frontend/components/ui/*`; Framer Motion used across marketing components (`frontend/components/CTA.tsx:4`); lucide icons (`frontend/app/layout.tsx:17`).
- **Global styles & Aurora**: Theme tokens live in `frontend/app/globals.css:4` (color variables, focus ring, aurora animations). `frontend/components/AuroraBG.tsx:1` renders animated gradients used in `frontend/app/page.tsx:4` and `frontend/app/trial/[nct_id]/screen/page.tsx:1`.
- **Feature flags**: `FEATURE_ALLOW_WRITES` blocks POSTs in `frontend/app/api/leads/route.ts:34`, `frontend/app/api/refer/route.ts:22`, `frontend/app/api/list-trial/route.ts:41`, `frontend/app/api/analytics/route.js:6`. `REVALIDATE_SECRET` protects revalidation (`frontend/app/api/revalidate/conditions/route.ts:6`). Writes remain disabled unless env flag explicitly `"true"`.

## 3) Data & Backend Boundaries
- **Supabase clients**:
  - Browser anon client (`frontend/lib/supabaseClient.ts:1`) for client components.
  - Server anon fallback (`frontend/lib/supabaseServer.ts:1`) for SSR routes like `frontend/app/trials/page.tsx:4`.
  - Service-role admin (`frontend/lib/supabaseAdmin.ts:1`) restricted to server-only routes (debug dashboard `frontend/app/debug/page.tsx:1`, write APIs).
  - Matching fetch uses public anon keys inside `frontend/lib/matchEngine.ts:468`.
- **Supabase table usage**: Reads from `trials` across list/detail pages (`frontend/app/trials/page.tsx:112`, `frontend/app/trial/[nct_id]/screen/page.tsx:19`) and condition catalog (`frontend/shared/conditions.catalog.ts:177`). Inserts into `patient_leads`, `physician_referrals`, `trial_submissions`, `events` via API routes noted above.
- **FastAPI service**: `api/app/main.py:59` exposes `/match` that processes `PatientData` (`api/app/main.py:16`) and upserts into Postgres `leads` table defined in `api/app/models.py:5`; DB connection in `api/app/database.py:1` reads `DATABASE_URL`.
- **Database schema touchpoints**: `criteria_json` column pulled in both trials page (`frontend/app/trials/page.tsx:166`) and screener page (`frontend/app/trial/[nct_id]/screen/page.tsx:24`). Data engine ensures hashes + metadata (`data_engine/parse_trial.py:724`, `data_engine/supabase_writer.py:49`).

## 4) Matching & Criteria
- **`criteria_json` lifecycle**: Generated in data engine (`data_engine/parse_trial.py:724`) and written via `data_engine/supabase_writer.py:65`. Consumed by match scoring (`frontend/lib/matchEngine.ts:204`), Trial screener (`frontend/components/Screener.tsx:102`), and shortlist flows (`frontend/app/trials/page.client.tsx:374`).
- **Parsing utilities**: `frontend/lib/criteria/adapter.ts:1` normalizes backend criteria into UI questions; `frontend/lib/criteria/normalize.ts` refines ordering; `frontend/lib/matching/evaluator.ts:1` scores answers; `docs/criteria_json_contract.md:3` documents contract.
- **Matching flow**:
  1. Prefill preview via `frontend/app/api/prefilter/route.js:1` (rate-limit + preview mode with `matchTrials`).
  2. Full match from `frontend/app/api/match/route.ts:52` builds `PatientProfile` and calls `matchTrials`.
  3. Client screener `frontend/components/Screener.tsx:215` adapts questions, validates with zod, emits evaluation back to shortlist (`frontend/app/trials/page.client.tsx:89`).
  4. Lead capture optionally feeds `/api/leads`.

## 5) Data Engine (Python)
- **Ingestion/CLI scripts**: `data_engine/backfill_missing_trials.py:1` orchestrates CT.gov fetch + OpenAI extraction; `data_engine/backfill_condition_slugs.py:1` normalizes slugs with `--confirm`; `data_engine/fix_conditions.py`, `data_engine/postfix_add_dx.py` handle targeted corrections.
- **ClinicalTrials.gov client**: `data_engine/ctgov_client.py:1` wraps HTTPX with retries. Parser heuristics in `data_engine/parser.py:1` detect visit models/travel support.
- **Supabase upsert**: `data_engine/supabase_writer.py:37` posts to `/trials?on_conflict=nct_id` using service-role key; budget controls + concurrency managed in backfill script (`data_engine/backfill_missing_trials.py:27`).
- **Output artifacts**: Structured criteria dumps stored under `data_engine/out/criteria/` (see directory listing), plus logs such as `data_engine/out/backfill_criteria.log`.
- **Dependencies**: `data_engine/requirements.txt:1` highlights httpx, tenacity, supabase, openai; `reqs_current.txt:1` pins versions for reproducibility.

## 6) Security & HIPAA-Aligned Posture
- **Write paths & RLS assumptions**: Service-role inserts to `patient_leads` (`frontend/app/api/leads/route.ts:71`), `physician_referrals` (`frontend/app/api/refer/route.ts:31`), `trial_submissions` (`frontend/app/api/list-trial/route.ts:50`), `events` (`frontend/app/api/analytics/route.js:28`). Comments note “RLS deny-all remains enforced” in `frontend/app/api/leads/route.ts:66`.
- **PII handling**: Lead API encrypts name/email/phone with AES-GCM using `PII_SECRET` (`frontend/app/api/leads/route.ts:19`), but hashes an empty secret if not set (risk flagged later).
- **Access controls**: `FEATURE_ALLOW_WRITES` default gate for dangerous endpoints. `REVALIDATE_SECRET` protects revalidation (`frontend/app/api/revalidate/conditions/route.ts:6`), albeit with fallback dev secret.
- **Logging & analytics**:
  - Client events in `frontend/lib/analytics.ts:1` respect `navigator.doNotTrack`.
  - Server route logs raw event payloads (`frontend/app/api/analytics/route.js:20`) and console-warns on Supabase failure.
  - Screener completion logs entire evaluation (`frontend/app/trials/page.client.tsx:85`) — potential PHI leak.
  - Debug page prints table counts using service key (`frontend/app/debug/page.tsx:11`).
- **Environment variables**: Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (various). Server-only: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PII_SECRET`, `FEATURE_ALLOW_WRITES`, `REVALIDATE_SECRET`, `NODE_ENV`. Data engine adds `OPENAI_API_KEY`, `ALLOW_EMPTY_CRITERIA`, `DISABLE_LLM`, etc (`data_engine/parse_trial.py:20`).
- **CSP & headers**: `frontend/next.config.mjs:1` injects CSP, HSTS, X-Frame-Options=DENY, Permissions-Policy (geolocation disabled).
- **Rate limiting**: Shared token bucket in `frontend/lib/rateLimitStore.ts:1` (Upstash Redis; falls back to in-memory with dev-only warning) shared by `/api/prefilter`, `/api/evaluate`, `/api/extract_profile`, `/api/match`.

## 7) Validation, Error Handling, and Testing
- **Input validation**:
  - Zod schemas in `frontend/app/api/leads/route.ts:9`, `frontend/app/api/refer/route.ts:9`, `frontend/app/api/list-trial/route.ts:9`, `frontend/app/api/match/route.ts:39`, and preview endpoints (`frontend/app/api/prefilter/route.js:5`, `frontend/app/api/evaluate/route.js:5`).
  - Client forms use zod via `react-hook-form` (`frontend/components/LeadForm.tsx:11`).
- **Error handling**:
  - Strong example: `frontend/app/api/leads/route.ts:96` returns structured JSON with status codes and encrypts before write.
  - Weak spot: `frontend/app/api/prefilter/route.js:155` logs errors but still returns `{ trials: [] }` with 200 status on failure, masking server issues.
- **Tests**:
  - Frontend unit tests in `frontend/lib/matchEngine.test.ts`, `frontend/lib/criteria/adapter.test.ts`, `frontend/lib/criteria/normalize.test.ts`.
  - Playwright suite `e2e/trials.spec.ts:1` covers shortlist, error states.
  - Data engine smoke scripts `data_engine/test_condition_processing.py`, `data_engine/test_enhanced_extraction.py`, `data_engine/test_realistic_extraction.py`.
  - Coverage not aggregated; no Jest config in root.
- **Gaps**: No automated tests for API write endpoints or encryption path; matching API depends on live Supabase access for deterministic runs.

## 8) Build, CI/CD, and Deploy
- **Scripts**: `frontend/package.json:6` defines `npm run dev|build|start|lint|test:e2e`. Root scripts wrap git workflows (`scripts/dev-branch.sh`, `scripts/ship.sh`).
- **CI**: Single GitHub Action `.github/workflows/lighthouse.yml:1` installs Node 18, builds Next, runs Lighthouse with thresholds defined in `lighthouserc.json:2`.
- **Deployment hints**: No `vercel.json`; Next config handles security headers. Playwright config (`playwright.config.ts:1`) expects production build.
- **Secret management**: Actions require `NEXT_PUBLIC_SUPABASE_*` and `LHCI_GITHUB_APP_TOKEN`; no automated secret scanning observed.

## 9) Performance Footprint
- **Heavy queries**: `frontend/lib/matchEngine.ts:489` fetches up to 500 trials per request with large `criteria_json`, increasing payload size. `frontend/app/trials/page.tsx:166` selects full `locations` + `criteria_json` for list view.
- **Inefficient loops**: `frontend/lib/getTrialCounts.ts:11` queries Supabase once per condition (13 sequential requests).
- **In-memory logs**: `frontend/shared/conditions.catalog.ts:173` rebuild logs on cache miss; heavy console output but minimal runtime impact.
- **Client bundle weight**: Framer Motion + Leaflet imported globally (`frontend/app/layout.tsx:5`, `frontend/components/maps/*`) — consider dynamic imports.
- **DB index visibility**: No schema migrations present; JSONB queries rely on `.contains` without notes on GIN indexes (uncertain).

## 10) UX & Content Signals
- **Tone & reassurance**: `frontend/app/match/MatchPageClient.tsx:33` includes affirmations and empathetic helper text; `frontend/components/Screener.tsx:126` provides reassurance copy per question; homepage messaging in `frontend/app/page.tsx:32` stresses privacy.
- **Progress indicators**: `frontend/app/match/MatchPageClient.tsx:213` computes progress and renders `<Progress>` (`frontend/components/ui/progress.tsx:1`); Screener uses progress at `frontend/components/Screener.tsx:276`.
- **Microcopy & empathy**: Consent modal and lead form reassure about data use (`frontend/components/LeadForm.tsx:116`). Sticky helper & shortlist messaging in `frontend/components/trials/StickyHelper.tsx`.
- **State persistence**: LocalStorage for shortlist and consent (`frontend/lib/compare/state.ts:20`, `frontend/app/match/MatchPageClient.tsx:28`).

## 11) Risks & Remediations
- **Missing PII secret fallback**: `frontend/app/api/leads/route.ts:19` hashes an empty string if `PII_SECRET` unset, weakening encryption. _Fix_: hard-fail when secret missing and add runtime health check.
- **Screener console logging PHI**: `frontend/app/trials/page.client.tsx:85` logs full evaluation (potential PHI/PII). _Fix_: remove or guard behind explicit dev flag.
- **Sequential count queries**: `frontend/lib/getTrialCounts.ts:11` hits Supabase 12+ times per request, risking rate limits. _Fix_: aggregate counts via RPC or single query with `group_by`.
- **Rate limiting configuration**: `frontend/lib/rateLimitStore.ts:1` uses Upstash when env vars present, otherwise warns and falls back to in-memory.
- **Analytics event logging**: `frontend/app/api/analytics/route.js:20` stores arbitrary `meta` without schema; potential PHI if clients misuse. _Fix_: validate payload keys and redact sensitive fields before insert.

## 12) Open Questions / Assumptions
- Does production set `FEATURE_ALLOW_WRITES="true"` only in controlled envs, and how is rotation handled?
- Should the legacy FastAPI service (`api/`) remain in sync with Supabase schema or is it deprecated?
- Are Supabase RLS policies enforcing read restrictions on `criteria_json` and leads tables (none checked in repo)?
- How are OpenAI costs monitored when `DISABLE_LLM` is off (`data_engine/backfill_missing_trials.py:27` budget logic assumes env values)?
- Is there a plan to consolidate analytics (current route logs to console and Supabase without schema constraints)?
- What is the deployment topology (single instance vs multi) given rate limiter limitations?
- Should `debug` page (`frontend/app/debug/page.tsx`) be production-protected or removed?
- Are there offline fallbacks if Supabase `trials` read fails (current paths swallow errors)?
- Do we need strict CSP adjustments for third-party assets (currently allows `https:` images broadly)?
- Any plan to version `criteria_json` schema as adapter evolves (`docs/criteria_json_contract.md`)?

## Quick Wins
- [ ] Fail fast when `PII_SECRET` missing and document required env in onboarding.
- [ ] Remove screener `console.log` statements before shipping.
- [ ] Refactor `getTrialCounts` to batch counts via RPC/wrapper view.
- [ ] Move rate limiting to durable store or edge middleware.
- [ ] Enforce schema on `/api/analytics` payload (whitelist keys, drop raw metadata).
- [ ] Lazy-load Leaflet/Framer Motion only on pages that need them to trim bundle.
- [ ] Add unit test covering `/api/leads` validation/encryption path.
- [ ] Create summary dashboard for data-engine runs (track `stats['errors']`).
- [ ] Add health check ensuring `FEATURE_ALLOW_WRITES` disabled in non-prod builds.
- [ ] Document Supabase table RLS expectations inside repo (`docs/`).

## Inputs for AGENTS.md
- Supabase service client (`frontend/lib/supabaseAdmin.ts`) stays server-only; never import into client code.
- Keep `FEATURE_ALLOW_WRITES` false outside controlled write environments.
- Only use `/api/leads` after confirming `PII_SECRET` + service-role key present.
- Treat `patient_leads` and `events` inserts as server-side responsibilities; no client direct writes.
- Require `no-store` on matching endpoints; avoid caching responses with PHI indicators.
- Validate analytics payloads to allow only trial metadata (nct_id, match_result, email_domain).
- Ensure criteria adapters conform to `docs/criteria_json_contract.md` before upstream changes.
- Run Playwright + Lighthouse checks before release branches.
- Use aggregated Supabase queries or cached catalog for condition counts to stay within rate limits.
- Disable debug utilities (`/app/debug`) or require authentication in production deployments.

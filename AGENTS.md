# AGENTS.md — PatientMatch Frontend Agent Guide (Strict Mode)

> Binding policy for automated changes in THIS repo. This repo is now a **Next.js storefront**.  
> The data pipeline and questionnaire generation live in a separate repo: **ct_project**.

## 0) TL;DR (what you may / may not do)

- ✅ Build UI features in **Next.js App Router (TypeScript)** using Tailwind + shadcn/ui + Framer Motion.
- ✅ Treat Supabase as the **serving database**. Read public trial + questionnaire data from `public.trials`.
- ✅ Use the **Direct Injection** pattern: convert `questionnaire_json` → `UiQuestion[]` via `frontend/lib/pmqAdapter.ts`.
- ✅ Use `public.trial_sites` for geospatial matching and `public.zip_centroids` for user origin lookup.
- ✅ Keep the “match profile” (age/sex/zip/diagnosis) as the single source of truth and **dedupe** those questions from trial-specific screens.

- ❌ Do NOT add or revive ingestion/parsing logic (CT.gov/AACT, criteria parsing, PMQ generation) in this repo.
- ❌ Do NOT use the legacy `criteria_json` field for new features.
- ❌ Do NOT create new Supabase tables without an explicit “serving contract” update in this doc.
- ❌ Do NOT use service-role keys in client code. No secrets in `NEXT_PUBLIC_*`.
- ❌ Do NOT log PII/PHI (including screener answers, zip, condition history). Remove console logs.

---

## 1) Repo scope & structure (CURRENT)

This repo contains:
- `frontend/` — Next.js App Router app (UI + Next route handlers)
- `supabase/migrations/` — optional, only if we choose to version DB schema here
- `docs/` — Documentation for the storefront and serving contract

Out of scope (lives in **ct_project**):
- AACT ingestion / DuckDB pipeline / PMQ generation
- Supabase “push” scripts and service-role writes of trial data

---

## 2) Product flows (CURRENT)

### A) Global intake: `/match`
- User answers “global” questions: age, sex at birth, zip/location, diagnosis confirmation, condition selection.
- Store these as the **Match Profile** (cookie/session). This is the canonical truth used everywhere.

### B) Trial browsing: `/trials`
- **Unified Discovery Page**: Proximity-first model showing all trials sorted by distance and quality.
- Read trial rows from Supabase `public.trials` (lightweight fields only).
- Calculate distance on-the-fly using `public.trial_sites` via the `nearest_sites_with_meta` RPC.
- Display using `PublicTrialCard` component (see `components/trials/PublicTrialCard.tsx`).

### C) Trial screener: `/trial/[nct_id]/screen`
- Fetch the trial’s `questionnaire_json` from `public.trials`.
- Use the Smart Adapter:
  - Convert PMQ → `UiQuestion[]` directly
  - Filter out questions already answered globally (age/sex/zip/diagnosis/etc.)
  - Return `{ uiQuestions, initialAnswers }`
- Render via `Screener.tsx` using `precalculatedQuestions` + `initialAnswers`.

---

## 3) Serving contract (Supabase)

The frontend’s single source of truth is the **Serving Layer**:

### `public.trials`
- `nct_id` (text, PK)
- `title` (text)
- `display_title` (text)
- `conditions` (text[])
- `questionnaire_json` (jsonb)  ✅ PMQ v10 payload
- `readiness` (bool)

### `public.trial_sites`
- `nct_id` (text, FK)
- `lat`, `lon` (float8)
- `facility_name`, `city`, `state`

### `public.zip_centroids`
- `postal_code` (text, PK)
- `lat`, `lon` (float8)

Policy assumption:
- Public read is allowed.
- Writes to these tables are performed by **ct_project**. The storefront should not write to them.

---

## 4) Frontend questionnaire architecture (DO NOT break this)

### Direct Injection pattern
- `frontend/lib/pmqAdapter.ts` converts `questionnaire_json` → `{ uiQuestions, initialAnswers }`
- `frontend/components/screener/Screener.tsx` accepts optional `precalculatedQuestions`.
- If `precalculatedQuestions` is provided, bypass all legacy `criteria_json` logic.

### Match Profile dedupe (mandatory)
The adapter must filter out globally-known keys when profile exists:
- `age_years`, `sex_at_birth`, `zip`, `diagnosis_confirmed`.

---

## 5) Supabase client rules

- Browser client: anon key only.
- Server client: anon key via `@supabase/ssr`.
- Service role: **NOT USED** in the storefront. Only in `ct_project` push scripts.

---

## 6) Legacy code policy

- `criteria_json` is **DEPRECATED**. New functionality must use `questionnaire_json`.
- **Archived Components**: `TrialCard.tsx` (replaced by `PublicTrialCard.tsx`), `/match` route (replaced by `/trials?mode=intake`).
- **Archived Docs**: `criteria_json_contract.md` (see `docs/archive/`).
- Legacy routes/components are moved to `docs/archive/` for reference.

---

## 7) Security & privacy guardrails (non-negotiable)

- No PII/PHI in logs.
- Encrypt PII before storage (e.g., in `leads` table) using `PII_SECRET`.
- Service role key must never reach the client.

---

## 8) Local dev loop

Storefront:
```bash
cd frontend
npm i
npm run dev
```

Data Pipeline:
- Lives in `ct_project` repo.

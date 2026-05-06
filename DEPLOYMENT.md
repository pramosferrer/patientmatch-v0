# PatientMatch Internal Deployment Notes

This is an internal reference for how PatientMatch v0 is wired across GitHub, Vercel, and Supabase, and how to ship updates now that the site is live.

Do not publish this file unless you intentionally decide it is safe to make public. It contains project identifiers and operational context, but no secret values.

## Current Wiring

### Live Site

- Production URL: https://patientmatch-v0.vercel.app
- Vercel project: `patientmatch-v0`
- Vercel project ID: `prj_7WxCj4rNNNgFTTuv95e2cNm7QaQb`
- Vercel team: `Pabs' projects`
- Vercel team slug: `pabs-projects-af924d68`
- Framework: Next.js
- App root: `frontend/`
- Node target: Node 20+ (`frontend/package.json` allows `>=20.11.0 <25`)

### GitHub

- Current v0 repo: `https://github.com/pramosferrer/patientmatch-v0`
- Default branch: `main`
- The v0 repo is a curated export from the older workspace, not a full dump of every historical/scratch file.
- Main app source: `frontend/`
- Supabase migrations: `supabase/migrations/`
- Lighthouse workflow: `.github/workflows/lighthouse.yml`

Important: the Vercel project is live, but it is not currently connected to the GitHub repo. The CLI Git connect attempt failed because Vercel could not access `pramosferrer/patientmatch-v0`. To enable automatic preview deployments, grant the Vercel GitHub app access to that repo and connect the existing Vercel project to it.

Until that is fixed, deployments are manual from the local checkout with the Vercel CLI.

### Supabase

- Production Supabase project: `patientmatch-pilot`
- Project ref: `zgkqpmsidsifarmqqhdz`
- Older inactive project: `patientmatch-mvp` is not used for v0.
- Browser reads use Supabase anon credentials.
- Server write/admin paths use the service role key only in server-side/Vercel env vars.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` through `NEXT_PUBLIC_*`, client code, logs, docs, or GitHub.

Launch hardening migrations applied to production and kept in the v0 repo:

- `supabase/migrations/20260504193000_launch_security_hardening.sql`
- `supabase/migrations/20260504194500_postgis_public_access_hardening.sql`

These addressed app-owned security issues:

- Converted serving views to `security_invoker=true`.
- Added RLS and policies for public/read and server-write tables.
- Set explicit `search_path` on `nearest_sites_with_meta`.
- Tightened public access around PostGIS extension objects where possible.

Residual Supabase advisor note: Supabase may still report extension-owned PostGIS findings around `spatial_ref_sys` and `st_estimatedextent`. Those were attempted but appear extension-managed/not owned by the app role. Treat them as a separate database-extension cleanup task.

## Vercel Environment Variables

Do not store actual values in this file.

Public browser variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Server-only variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PII_SECRET`
- `FEATURE_ALLOW_WRITES`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `UPSTASH_REDIS_DISABLED`

Current production context:

- `FEATURE_ALLOW_WRITES=false`
- `UPSTASH_REDIS_DISABLED=1`

Because `UPSTASH_REDIS_DISABLED=1`, production currently uses the in-memory rate limiter fallback. That is acceptable as a launch fallback, but shared Redis-backed limiting is stronger because Vercel serverless instances do not share memory. Before higher traffic, provision Upstash Redis, set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, then remove `UPSTASH_REDIS_DISABLED` or set it to `0`.

## What Was Done For Launch

- Removed disabled lead/contact collection code and `/api/leads`.
- Removed `/debug` routes and debug-only pages.
- Removed backup files, one-off scripts, scratch trial dumps, and orphaned utilities.
- Removed development console logging from PMQ adapter code.
- Fixed proximity pagination so pages return the intended count.
- Added rate limiting to high-cost public API routes and server write routes.
- Upgraded Next.js/React in the v0 repo.
- Updated Lighthouse CI to Node 20.
- Added comments clarifying Supabase client usage:
  - public read-only data uses the server anon client,
  - auth/user routes use the SSR cookie-aware client,
  - admin writes use the service role client.

Launch verification that passed:

- `npm run build` from `frontend/`.
- `npm run lint` from `frontend/`, with two remaining React hook warnings.
- `https://patientmatch-v0.vercel.app/` returned HTTP 200.
- `/debug` returned HTTP 404.
- `/api/leads` returned HTTP 404.
- `/api/trials?condition=long_covid&page=1` returned live trial JSON.

Known audit context:

- `npm audit --omit=dev` still reported two moderate PostCSS/Next audit items.
- The suggested audit fix attempted to downgrade Next.js, so it was not applied.

## Recommended Shipping Workflow

### 1. Work From The v0 Repo

Use the v0 repo as the source of truth for launch work.

```bash
cd /private/tmp/patientmatch-v0
git checkout main
git pull origin main
```

For a clean clone:

```bash
git clone https://github.com/pramosferrer/patientmatch-v0.git
cd patientmatch-v0
```

### 2. Create A Branch

```bash
git checkout -b codex/short-description
```

Use a branch for every meaningful change. Avoid committing directly to `main` unless it is an urgent production fix.

### 3. Iterate Locally In Codex

```bash
cd frontend
npm install
npm run dev
```

Before preview or review:

```bash
npm run lint
npm run build
```

Run Playwright when touching patient-facing flows:

```bash
npm run test:e2e
```

Manual smoke checks should include:

- `/`
- `/trials`
- a condition search
- zip/proximity search
- saved/account flows if touched
- any API route touched by the change

### 4. Push A Branch And Open A PR

```bash
git status
git add .
git commit -m "Describe the change"
git push -u origin codex/short-description
```

The PR should include:

- what changed,
- why it changed,
- test/build results,
- screenshots or preview links for UI changes,
- Supabase migration notes for database changes.

Do not merge patient-facing changes until build and smoke checks pass.

### 5. Preview Before Production

Target state after Vercel Git integration is fixed:

- PR branch push creates a Vercel Preview Deployment.
- Review the preview URL before merging.
- GitHub Actions runs Lighthouse CI for frontend changes.
- Merge to `main` triggers production deployment.

Current manual preview fallback:

```bash
cd /private/tmp/patientmatch-v0/frontend
npx vercel deploy --scope pabs-projects-af924d68
```

Preview smoke checks:

```bash
curl -sS -I <preview-url>/
curl -sS -I <preview-url>/debug
curl -sS -I <preview-url>/api/leads
curl -sS '<preview-url>/api/trials?condition=long_covid&page=1'
```

Expected:

- `/` returns 200.
- `/debug` returns 404.
- `/api/leads` returns 404.
- `/api/trials?...` returns valid JSON.

### 6. Release To Production

Preferred after Git integration:

1. Merge the reviewed PR into `main`.
2. Let Vercel deploy production from `main`.
3. Verify production with the same smoke checks.

Manual fallback while Git integration is not connected:

```bash
cd /private/tmp/patientmatch-v0/frontend
npx vercel deploy --prod --scope pabs-projects-af924d68
```

Production smoke checks:

```bash
curl -sS -I https://patientmatch-v0.vercel.app/
curl -sS -I https://patientmatch-v0.vercel.app/debug
curl -sS -I https://patientmatch-v0.vercel.app/api/leads
curl -sS 'https://patientmatch-v0.vercel.app/api/trials?condition=long_covid&page=1'
```

### 7. Roll Back If Needed

Use Vercel rollback from the dashboard or CLI:

```bash
npx vercel rollback --scope pabs-projects-af924d68
```

Then revert or fix the GitHub branch so the repo matches the intended production state.

## Database Change Workflow

Database changes should be slower and more deliberate than UI-only edits.

For Supabase changes:

1. Create or edit a migration in `supabase/migrations/`.
2. Review RLS impact.
3. Prefer additive migrations.
4. Apply to staging first once a staging project exists.
5. Run Supabase advisors after applying.
6. Verify with a direct query or app flow.
7. Apply to production only after verification.

Current gap: v0 uses the production Supabase project directly. A good next step is creating a separate Supabase staging project and configuring Vercel Preview deployments to use staging Supabase env vars. That creates a real review step for database-backed changes.

## Recommended Next Improvements

1. Connect Vercel Git integration to `pramosferrer/patientmatch-v0`.
2. Add branch protection on `main` requiring PR review and passing checks.
3. Add a dedicated GitHub Actions workflow for `npm ci`, `npm run lint`, and `npm run build`.
4. Create a staging Supabase project for Vercel previews.
5. Provision Upstash Redis for shared production rate limiting.
6. Decide how to handle residual Supabase PostGIS advisor findings.
7. Add privacy-conscious monitoring, such as Vercel Web Analytics and function error alerts.

## Mental Model

- GitHub is the source of truth for code.
- Vercel serves the Next.js app and API routes.
- Supabase is the production database and auth/data API.
- Vercel env vars connect the deployed app to Supabase and rate limiting.
- PRs should be reviewed through preview deployments before production.
- Production should move only after lint, build, smoke checks, and preview review pass.

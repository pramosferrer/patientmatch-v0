# PatientMatch Deployment Notes

Internal reference for how PatientMatch v0 is wired across GitHub, Vercel, and Supabase, and how to ship updates without repeating the old subdirectory deployment failures.

Do not publish this file unless you intentionally decide it is safe to make public. It contains project identifiers and operational context, but no secret values.

## Current Wiring

### Live Site

- Production URL: https://patientmatch.health
- Vercel project: `patientmatch-v0`
- Vercel project ID: `prj_7WxCj4rNNNgFTTuv95e2cNm7QaQb`
- Vercel team: `Pabs' projects`
- Vercel team slug: `pabs-projects-af924d68`
- Framework: Next.js App Router
- App root: repository root (`/`)
- Vercel Root Directory: blank
- Output Directory: blank / Next.js default
- Build command: `npm run build`
- Node target: Node 20 (`package.json` requires `>=20.11.0 <21`)

Important: the Next.js app was moved from `frontend/` to the repository root in May 2026. Do not set Vercel Root Directory to `frontend`, do not run `cd frontend`, and do not use `npm --prefix frontend` for this repo. Those stale assumptions caused repeated preview failures.

### GitHub

- Current v0 repo: `https://github.com/pramosferrer/patientmatch-v0`
- Default branch: `main`
- Source app paths: `app/`, `components/`, `lib/`, `shared/`, `hooks/`, `config/`, `public/`
- Supabase migrations: `supabase/migrations/`
- Lighthouse workflow: `.github/workflows/lighthouse.yml`

Vercel Git integration is connected. Branch pushes create Preview deployments. Merging to `main` creates the Production deployment. Prefer this path over direct CLI production deploys.

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

Residual Supabase advisor note: Supabase may still report extension-owned PostGIS findings around `spatial_ref_sys` and `st_estimatedextent`. Those appear extension-managed/not owned by the app role. Treat them as a separate database-extension cleanup task.

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

Environment variables needed by previews must be available to Preview as well as Production. A common failure mode is adding a variable only to Production and then wondering why PR previews fail.

Current production context:

- `FEATURE_ALLOW_WRITES=false`
- `UPSTASH_REDIS_DISABLED=1`

Because `UPSTASH_REDIS_DISABLED=1`, production currently uses the in-memory rate limiter fallback. That is acceptable as a launch fallback, but shared Redis-backed limiting is stronger because Vercel serverless instances do not share memory. Before higher traffic, provision Upstash Redis, set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, then remove `UPSTASH_REDIS_DISABLED` or set it to `0`.

## Recommended Shipping Workflow

### 1. Start From A Clean Branch

The shared local workspace is often dirty because multiple tools work in it. For release work, prefer a clean branch or worktree from `origin/main`.

```bash
git fetch origin
git worktree add -b codex-short-description /private/tmp/patientmatch-change origin/main
cd /private/tmp/patientmatch-change
```

If working in the main checkout, inspect status first and do not stage unrelated files:

```bash
git status --short --branch
```

### 2. Iterate Locally From Repo Root

```bash
npm install
npm run dev
```

Use the root package scripts only. There is no active `frontend/` app directory.

Before pushing:

```bash
npm run lint -- --quiet
npm run build
```

Run Playwright when touching patient-facing flows:

```bash
CI=1 npx playwright test e2e/screener.spec.ts --reporter=line
```

Manual smoke checks should include:

- `/`
- `/trials`
- a condition search
- zip/proximity search
- saved/account flows if touched
- any API route touched by the change

### 3. Push A Branch And Open A PR

```bash
git status --short
git add <intended files only>
git commit -m "Describe the change"
git push -u origin codex-short-description
```

The PR should include:

- what changed,
- why it changed,
- test/build results,
- screenshots or preview links for UI changes,
- Supabase migration notes for database changes.

Do not merge patient-facing changes until the build and smoke checks pass.

### 4. Preview Before Production

Preferred path:

1. Push the branch.
2. Wait for the Vercel Preview deployment.
3. Open the preview URL and smoke test the touched paths.
4. Check GitHub Actions/Lighthouse if it applies.
5. Merge to `main` only after preview is healthy.

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

Preview deployments may show a Vercel "Forbidden" page when opened from the dashboard preview frame or when deployment protection is enabled. Use the browser "Visit" URL in a normal tab or authenticate as needed before treating that as an app failure.

### 5. Release To Production

Preferred path:

1. Merge the reviewed PR into `main`.
2. Let Vercel deploy production from `main`.
3. Verify production with the same smoke checks.
4. Confirm the custom domain if cache/DNS makes the generated Vercel URL look fresher than https://patientmatch.health.

Production smoke checks:

```bash
curl -sS -I https://patientmatch.health/
curl -sS -I https://patientmatch.health/debug
curl -sS -I https://patientmatch.health/api/leads
curl -sS 'https://patientmatch.health/api/trials?condition=long_covid&page=1'
```

Manual CLI deployment is a fallback only:

```bash
npx vercel deploy --scope pabs-projects-af924d68
npx vercel deploy --prod --scope pabs-projects-af924d68
```

If using the CLI fallback, run it from the repository root. Do not run it from `frontend/`.

## Rollback

Use Vercel rollback from the dashboard or CLI:

```bash
npx vercel rollback <deployment-url-or-id> --scope pabs-projects-af924d68
```

After rollback:

1. Confirm the production URL serves the expected previous version.
2. Revert or fix the bad commit in GitHub.
3. Open a follow-up PR so `main` and production converge again.

## Known Failure Modes

- Vercel Root Directory set to `frontend`: Vercel cannot find the app or may fail finalization. Root Directory must be blank.
- Build command overridden incorrectly: use the project default or `npm run build` from repo root.
- Output Directory overridden: leave blank for Next.js default output.
- Node version mismatch: Vercel should use Node 20 to satisfy `package.json` engines.
- Environment variables scoped only to Production: branch previews can fail or behave differently.
- Dirty shared checkout: unrelated local files can be staged accidentally. Use a clean worktree for release changes.
- Turbopack route manifest finalizer errors on Vercel: the root build script uses `next build --webpack` to avoid this class of issue.

## Future Improvements

- Add a staging Supabase project for Vercel Preview deployments.
- Add a small deployment check script that validates Vercel project settings through the API.
- Add privacy-conscious monitoring, such as Vercel Web Analytics and function error alerts.
- Decide whether `scripts/ship.sh` should stay as a convenience helper or be removed in favor of explicit GitHub PR flow.

## Mental Model

- GitHub `main` is the source of truth.
- Vercel serves the Next.js app and API routes from the repository root.
- Supabase serves public trial/questionnaire data and secured server-side writes.
- Vercel env vars connect the deployed app to Supabase and rate limiting.
- PRs should be reviewed through preview deployments before production.

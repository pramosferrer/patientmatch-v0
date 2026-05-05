# PatientMatch v0

Privacy-first clinical trial discovery for patients.

## Structure

- `frontend/` - Next.js app deployed on Vercel.
- `supabase/` - Supabase configuration and migrations.
- `.github/workflows/` - CI and Lighthouse checks.

## Local Development

```bash
cd frontend
npm install
npm run dev
```

## Required Environment Variables

Configure these in Vercel for Preview and Production:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PII_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `FEATURE_ALLOW_WRITES`

`FEATURE_ALLOW_WRITES` should remain `false` unless a specific write path has been reviewed.

## Deployment

Use `frontend` as the Vercel project root directory.

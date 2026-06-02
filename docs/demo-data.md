# Demo Data

PatientMatch can be developed against a real Supabase serving layer or synthetic local data.

The demo fixtures in `fixtures/demo/` are intentionally synthetic. They are designed to show the expected shape of trial metadata, sites, ZIP centroids, and questionnaire payloads without including real patient information.

## Files

- `fixtures/demo/trials.json` - sample `public.trials` rows.
- `fixtures/demo/trial_sites.json` - sample `public.trial_sites` rows.
- `fixtures/demo/zip_centroids.json` - sample `public.zip_centroids` rows.
- `fixtures/demo/seed.sql` - SQL inserts for a local Supabase/Postgres database.

## Local Supabase Outline

1. Create the serving tables described in `docs/serving_contract.md`.
2. Apply `fixtures/demo/seed.sql`.
3. Set `.env.local` to point at the local Supabase project using anon credentials.
4. Run `npm run dev`.

## Unit-Tested Demo Path

The synthetic questionnaire fixture is covered by `lib/pmqAdapter.demo.test.ts`.

Run:

```bash
npm run demo:check
npm run test:unit
```

These checks verify that the demo rows are internally consistent, that the demo PMQ payload converts to UI questions, and that global match-profile fields are deduplicated.

Use only synthetic profile values while testing. Do not add real patient data to fixtures, screenshots, or public issues.

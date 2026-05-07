# PatientMatch v0

PatientMatch is a Next.js App Router application for privacy-first clinical trial discovery.

## Local Development

Run from the repository root:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Before pushing patient-facing changes:

```bash
npm run lint -- --quiet
npm run build
```

Run targeted Playwright tests when touching matching, questionnaire, or trial browsing flows:

```bash
CI=1 npx playwright test e2e/screener.spec.ts --reporter=line
```

## Deployment

The active Next.js app lives at the repository root. Vercel Root Directory must be blank, Output Directory must be blank, and builds should run `npm run build` from the repository root.

Branch pushes create Vercel Preview deployments. Merging to `main` creates the Production deployment.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full runbook.

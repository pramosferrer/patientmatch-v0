# Security Advisory Tracking

This document tracks dependency advisories that cannot be safely resolved by an automatic fix.

## Next.js transitive PostCSS advisory

- Status: tracked
- GitHub issue: https://github.com/pramosferrer/patientmatch-v0/issues/4
- Severity from `npm audit`: moderate
- Package path: `next -> postcss`
- Advisory: PostCSS XSS via unescaped `</style>` in CSS stringify output
- Current behavior: `npm audit --audit-level=high` passes.
- Automatic fix caveat: `npm audit fix --force` currently proposes downgrading Next.js to `9.3.3`, which would break the App Router stack and is not an acceptable fix.

Resolution plan:

1. Keep Next.js on the latest compatible release.
2. Re-run `npm audit` after Next.js releases a compatible patched dependency path.
3. Prefer a normal dependency update over forced downgrades.

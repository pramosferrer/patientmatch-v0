# PatientMatch Storefront Overview

## Architecture: Two Repos, One Database

This repository (`patientmatch`) is the **Storefront**. It is responsible for the patient-facing UI, intake flows, and trial matching.

1.  **Factory (`ct_project`)**: (External Repo) Handles AACT ingestion, DuckDB processing, PMQ (questionnaire) generation, and pushing data to Supabase.
2.  **Serving (`Supabase`)**: The shared database. `ct_project` writes to it; `patientmatch` reads from it.
3.  **Storefront (`patientmatch`)**: (This Repo) Next.js App Router application.

## Folders
- `/app`: Next.js App Router pages and route handlers
- `/components`: UI components
- `/lib`: Supabase access, matching logic, questionnaire adapter, and utilities
- `/shared`: Shared config, constants, utilities
- `/supabase/migrations`: Database schema versioning (optional)
- `/docs`: Project documentation and architecture notes

Deployment note: the active Next.js app lives at the repository root. Older notes may mention `/frontend`; that subdirectory was retired in May 2026 and should not be used for builds or deployments.

## Stack
- **Frontend**: Next.js (App Router), Tailwind CSS, Shadcn/UI, Framer Motion
- **Backend**: Next.js API Routes (Serverless)
- **Database**: Supabase Postgres
- **Geospatial**: PostGIS (via `public.trial_sites` and `public.zip_centroids`)

## Workflow
- **Data Flow**: `ct_project` → Supabase `public.trials` + `public.trial_sites`.
- **Frontend**: Queries Supabase directly via `@supabase/ssr`.
- **Matching**: Performed in-memory (frontend/server) using injected `questionnaire_json`.
- **Geospatial**: Distance is computed using user ZIP (via `zip_centroids`) and site coordinates.

## Development Diary

### 2024-12-19: Trials Page Production Polish
**Branch:** `ui/trials-polish`

Added comprehensive UX polish to the trials list page with the following enhancements:

#### Empty & Error States
- Implemented `EmptyState` and `ErrorState` components with calm illustrations
- Added proper CTAs: "Reset filters" and "Find My Match" for empty states
- Network error handling with retry functionality
- Maintains skeleton continuity on initial load

#### "New" Badge System
- Added 14-day window detection for trial freshness
- Shows emerald "New" pill near condition chip
- Uses `created_at` or `first_posted_date` fields
- AA contrast compliant, doesn't compete with CTG icon

#### Shortlist & Compare Drawer
- Icon-only save button on each trial card
- Bottom compare drawer (shadcn/ui Sheet) appears when shortlist ≥ 1
- Max 3 trials enforced with non-blocking toast for limit reached
- Compact comparison table: Title, Phase, Sites, Age, Location/Remote
- Session-persisted in localStorage
- Keyboard accessible with proper aria labels

#### Sticky "Find My Match" Helper
- Mobile: bottom full-width pill above system bars
- Desktop: bottom-right small card
- Session hide after first click (localStorage flag)
- Respects theme and doesn't overlap system UI

#### Distance Chip (Optional)
- Async geolocation with localStorage caching
- Haversine formula for distance calculation
- Shows "12 mi" format or "—" if unknown
- Non-blocking hydration to avoid layout shift

#### Analytics Integration
- Enhanced analytics with DNT respect
- Trial-specific events: `trial_impression`, `trial_cta_click`, `trial_saved_to_shortlist`, etc.
- Device detection (mobile/desktop)
- No PII collection, easily filterable by nct_id

#### JSON-LD Schema Injection
- Schema.org MedicalStudy/ClinicalTrial format
- Includes: name, identifier (NCT ID), sponsor, studyDesign, trialStatus
- Payload size guarded (<100KB total)
- Only visible trials included

#### Lighthouse CI Guardrails
- Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95
- Runs on PR and main branch pushes
- Temporary public storage for results
- Chrome flags for CI environment

#### Playwright E2E Tests
- Comprehensive test suite for trials page core flows
- Tests: skeleton → cards, "New" badge, shortlist (max 3), compare drawer
- CTG link new tab verification
- Empty/error state rendering
- Sticky helper behavior
- Load more functionality
- Cross-browser testing (Chrome, Firefox, Safari, Mobile)

#### Technical Implementation
- Maintained existing styling system (Next.js App Router + Tailwind + shadcn/ui)
- All new components follow AA accessibility standards
- Performance optimized with async hydration and skeleton continuity
- Consistent with existing design tokens and spacing
- No breaking API changes

**Files Modified:**
- `/components/ui/EmptyState.tsx` (new)
- `/components/ui/ErrorState.tsx` (new)
- `/components/ui/scroll-area.tsx` (new)
- `/components/trials/TrialCard.tsx` (enhanced)
- `/components/trials/LoadMoreTrials.tsx` (enhanced)
- `/components/trials/CompareDrawer.tsx` (new)
- `/components/trials/StickyHelper.tsx` (new)
- `/components/trials/JsonLd.tsx` (new)
- `/lib/compare/state.ts` (new)
- `/lib/location/distance.ts` (new)
- `/lib/analytics.ts` (enhanced)
- `/app/trials/page.tsx` (enhanced)
- `/package.json` (Playwright scripts)
- `/playwright.config.ts` (new)
- `/e2e/trials.spec.ts` (new)
- `/.github/workflows/lighthouse.yml` (new)
- `/lighthouserc.json` (new)

**Acceptance Criteria Met:**
✅ Empty/error states implemented and demoable  
✅ "New" badge works with mocked recent trial  
✅ Compare drawer (save/clear/max-3) shipped  
✅ Sticky helper implemented with session hide  
✅ Distance chip hydrates async  
✅ Analytics events firing (no PII)  
✅ JSON-LD injected and validated  
✅ LHCI thresholds enforced in CI  
✅ Playwright E2E added and passing  
✅ Dev Diary updated

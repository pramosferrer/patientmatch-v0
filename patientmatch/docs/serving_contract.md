# Serving Contract

This document defines the schema and data format for the **Serving Layer** (Supabase) that connects the data factory (`ct_project`) to the storefront (`patientmatch`).

## Core Tables

### `public.trials`
The primary table for clinical trial metadata and questionnaires.

| Column | Type | Status | Description |
| --- | --- | --- | --- |
| `nct_id` | `text` (PK) | **Required** | ClinicalTrials.gov identifier. |
| `title` | `text` | **Required** | Official title of the study. |
| `conditions` | `text[]` | **Required** | Array of normalized condition names. |
| `questionnaire_json` | `jsonb` | **Required** | **PMQ v10 payload**. Contains injected questions and logic. |
| `status_bucket` | `text` | **Required** | Simplified status (e.g., "Recruiting"). |
| `quality_score` | `float8` | **Required** | Data quality metric for sorting. |
| `sponsor` | `text` | **Optional** | Lead sponsor name. |
| `phase` | `text` | **Optional** | Trial phase (e.g., "Phase 2"). |
| `status` | `text` | **Optional** | Raw status from CT.gov. |
| `states_list` | `text[]` | **Optional** | List of US states with active sites. |
| `readiness` | `boolean` | **Optional** | Flag for display readiness. |
| `is_publishable` | `boolean` | **Optional** | Flag for public visibility. |

### `public.trial_sites`
Geospatial data for trial locations.

| Column | Type | Description |
| --- | --- | --- |
| `nct_id` | `text` (FK) | References `public.trials.nct_id`. |
| `facility_name` | `text` | Name of the site/hospital. |
| `city` | `text` | City name. |
| `state` | `text` | State abbreviation or name. |
| `postal_code` | `text` | ZIP/Postal code. |
| `lat` | `float8` | Latitude. |
| `lon` | `float8` | Longitude. |

### `public.zip_centroids`
Reference table for user location lookup.

| Column | Type | Description |
| --- | --- | --- |
| `postal_code` | `text` (PK) | 5-digit US ZIP code. |
| `lat` | `float8` | Latitude of the centroid. |
| `lon` | `float8` | Longitude of the centroid. |

## Read RPCs (Read-only)

### `nearest_sites_with_meta`
Used for distance-based sorting and site metadata retrieval.
- **Purpose**: Find trials with sites near a specific location.
- **Inputs**: `in_lat` (float8), `in_lon` (float8), `max_miles` (float8, optional).
- **Outputs**: `nct_id`, `city`, `state` (from `state_code`), `facility_name`, `lat`, `lon`, `nearest_miles`.
- **Implementation**: Uses PostGIS `ST_Distance` on `trial_sites.geom` geography column for precise calculations.
- **Usage**: Used by `/trials` page for proximity-based sorting and filtering.
- **Status**: ✅ Active in `patientmatch-pilot` project (applied via migration `recreate_nearest_sites_rpc_v3`).

## Query Guidance

To optimize performance, the storefront should follow these selection rules:

- **`/trials` list**: Select only metadata (`nct_id`, `title`, `status_bucket`, `conditions`, `quality_score`). **Do NOT select `questionnaire_json`** in list views.
- **`/trial/[nct_id]/screen`**: Select `questionnaire_json` and minimal metadata for the specific trial.

## Questionnaire JSON (PMQ v10)

The `questionnaire_json` field follows the PMQ v10 specification. It is converted to `UiQuestion[]` by `frontend/lib/pmqAdapter.ts`.

### Global Profile Deduplication
The storefront automatically filters out questions that are already answered in the user's **Match Profile**:
- `age_years`
- `sex_at_birth`
- `zip`
- `diagnosis_confirmed`

## Geospatial Logic
Distance is **not** stored in the database. It is computed on-the-fly by the storefront:
1. Lookup user's `lat`/`lon` from `public.zip_centroids` using their ZIP.
2. Fetch sites for relevant trials from `public.trial_sites` or via RPC.
3. Compute Haversine distance in the frontend or server-side logic.

# Screener Trace – NCT04396574

## A. Route & data flow
- `frontend/app/trial/[nct_id]/screen/page.tsx:35-170` loads headers/cookies, resolves friendly URL, reads the profile cookie via `readProfileCookie` and selects the trial row from Supabase with the explicit column list (`criteria_json`, age bounds, gender, etc.) before passing the trimmed props into `TrialScreenClient`.
- `TrialScreenClient` receives those props and merges cookie/session/profile data: it derives gating metadata (`deriveProfileFromAnswers`, `assessGate`) and decides whether to show the gate, the screener, or results (`frontend/app/trial/[nct_id]/screen/TrialScreenClient.tsx:332-436`).
- When the screener should render, `TrialScreenClient` forwards `trial`, `initialAnswers`, `initialProfile`, and the `showDebug` flag to `Screener` (`TrialScreenClient.tsx:425-435`). That `showDebug` flag is activated when the page-level `?debug=1` query is present (`page.tsx:44-47`, `TrialScreenPage` passes it through as `showDebug={debug === "1"}` on line 169).
- `Screener` memoizes the trial questionnaire by calling `adaptCriteriaJson` exactly once per mount and then normalizes it with `normalizeQuestionnaire`, injecting demographic questions and computing clinic-only counts (`frontend/components/Screener.tsx:520-546`). It keeps that normalized object in a ref so repeated renders reuse the same structure.

## B. Question object contract
- `UiQuestion` is the shape expected by the UI (`frontend/lib/criteria/adapter.ts:30-47`). Required fields include `id`, `kind`, `label`, the backing `clause` (with `criterion_id`, `type`, `rule`), optional `sourceTag`, `options`, `operator`, numeric bounds (`minValue`, `maxValue`, inclusion flags) and display helpers (`unit`, `placeholder`, `helperText`).
- `adaptCriteriaJson` builds these questions from raw criteria clauses; it decides the `kind` (`boolean`/`number`/`choice`), infers options, numeric bounds, and placeholders (`adapter.ts:126-204`). If a clause has no `rule`, `resolveSourceTag` defaults to `"clinic"` (`adapter.ts:126-128`), which is important for the age clause in this trial.
- `normalizeQuestionnaire` then classifies each clause (`normalize.ts:396-441`). Pure clinic clauses move into `clinicItems`, split clauses become both patient and clinic rows, and the remaining patient list passes through `injectDemographicQuestions` (which adds `dem_age`, `dem_sex`, `dem_pregnancy`) and deduplication (`normalize.ts:443-454` combined with `classifier.ts:167-207`).
- `classifier.ts` sets `sourceTag`/flow decisions: `classifyClause` chooses `"patient"`, `"clinic"`, or `"split"` using rule metadata and text heuristics (`classifier.ts:108-134`). Demographic injection also sets explicit placeholders, units, and min/max bounds when age metadata is present (`classifier.ts:167-204`).

## C. Render gating in `Screener`
- `getQuestionKind` unifies the `kind`/`type`/`inputType` and falls back to numeric heuristics for age/weight variables (`frontend/components/Screener.tsx:184-199`).
- The main render path checks `totalSteps`; if zero it returns a “Nothing to answer here” card (`Screener.tsx:1315-1336`). Otherwise it computes `currentQuestion` and hands it to `renderInput`.
- `renderInput` performs a `getQuestionKind` switch: booleans render a yes/no button grid, numbers render the `<Input type="number">`, choices render button grids or a `<select>` when options > 4, and unknown kinds fall back to a text input (`Screener.tsx:1341-1480`).
- Inputs can be suppressed only by: zero `primary` questions (clinic-only), gating before the screener (handled entirely in `TrialScreenClient`), or failing validation in `handleSave` (which keeps the input visible but surfaces an error). Compact mode only alters layout (`Screener.tsx:1560-1600`); it does not change the switch logic.
- With `?debug=1`, the component now emits `console.info("[ScreenerDebug] ActiveQuestion", …)` whenever the active question changes and overlays a badge showing `patientCount • clinicOnlyCount • kind` on the screener card (`Screener.tsx:553-575` and `600-615`). This only toggles when the debug flag is on.

## D. Runtime trace for NCT04396574
- Raw `criteria_json` (ingested copy in `data_engine/out/criteria/NCT04396574_criteria.json`) contains 3 inclusion + 3 exclusion clauses (`scripts/screener_trace.ts` reports the same via `.criteria_norm` lengths when present).
- After normalization, we have `patientCount = 3`, `clinicOnlyCount = 5`. Clinic items include the age range clause (`criterion_id: "C2"`), showing that the ingestion marked it clinic-only.
- The first five patient questions and their essential fields:

```json
[
  {
    "criterion_id": "dem_age",
    "category": "demographics",
    "sourceTag": "patient",
    "kind": "number",
    "type": null,
    "inputType": null,
    "rule": { "variable": "age_years", "operator": null, "value": null },
    "label": "How old are you?",
    "unit": null,
    "placeholder": "Enter your age in years",
    "minValue": null,
    "maxValue": null
  },
  {
    "criterion_id": "C4",
    "category": "Reproductive health",
    "sourceTag": "patient",
    "kind": "boolean",
    "type": null,
    "inputType": null,
    "rule": null,
    "label": "Are you currently reproductive health?",
    "unit": null,
    "placeholder": null,
    "minValue": null,
    "maxValue": null
  },
  {
    "criterion_id": "C3",
    "category": "Weight",
    "sourceTag": "patient",
    "kind": "boolean",
    "type": null,
    "inputType": null,
    "rule": null,
    "label": "Do you have weight?",
    "unit": null,
    "placeholder": null,
    "minValue": null,
    "maxValue": null
  }
]
```

- For the active first question (`dem_age`):
  - `getQuestionKind` resolves to `"number"` (Screener logic).
  - `renderInput` therefore selects the `numeric-input` branch (number field).
- Harness: `scripts/screener_trace.ts` fetches the trial via `getServerSupabase`, runs the same adapter/normalizer, prints raw/normalized counts, the simplified first-five payload, and the first-question branch. Run with Supabase env vars set (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) using `npx tsx scripts/screener_trace.ts NCT04396574`. Without creds the script exits with “Missing Supabase environment variables.” The debug badge/logs appear in the browser at `/trial/NCT04396574/screen?debug=1`.

## E. Root-cause hypothesis
The clinical age clause (`criterion_id "C2"`) arrives without a structured `rule` and is tagged `source: "site"` in the raw criteria (`data_engine/out/criteria/NCT04396574_criteria.json`). Because `resolveSourceTag` defaults such clauses to `"clinic"` and `classifyClause` sees no patient-specific rule (`frontend/lib/criteria/adapter.ts:126-128`, `classifier.ts:108-134`), `normalizeQuestionnaire` moves it into `clinicItems` (`normalize.ts:396-454`). The patient flow therefore never renders that clause, instead relying on the fallback demographic injection (`classifier.ts:167-207`) to ask “How old are you?” Without min/max metadata, the injected question has no range context, and the original clinic-only item shows up in the sidebar with no input. In the UI this appears as an age requirement that cannot be answered directly, explaining why testers see “the age question” without an input field. The underlying issue is the ingestion/classification of the age criterion as clinic-only rather than supplying a patient-facing numeric rule.

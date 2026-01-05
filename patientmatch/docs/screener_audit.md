# Trial Screener Audit

## Architecture Map (Current)
```mermaid
graph TD
  A[Trials listing<br/>frontend/app/trials/page.tsx] -->|renders| B[TrialCard<br/>frontend/components/trials/TrialCard.tsx]
  B -->|CTA navigates| D[TrialScreenPage<br/>frontend/app/trial/[nct_id]/screen/page.tsx]
  D -->|fetches Supabase<br/>public.trials.questionnaire_json| E[getServerSupabase]
  D -->|passes props| F[TrialScreenClient]
  F -->|adapts PMQ| G[pmqAdapter.ts]
  G -->|injects| H[Screener component<br/>frontend/components/screener/Screener.tsx]
  H -->|collect answers| I[react state + localStorage]
  H -->|evaluate| J[evaluateTrial]
  J -->|result| K[ScreenResult]
  
  subgraph Factory (External)
    L[ct_project repo] -->|pushes PMQ| M[Supabase public.trials]
  end
  M -->|serves| D
```

## `criteria_json` Contract (Current vs. Ideal)

| Field | Current Behavior | Issues Observed | Ideal Contract |
| --- | --- | --- | --- |
| `criterion_id` | Required, often synthetic (`age_min`) or sequential (e.g. `"1"`) – see `data_engine/out/criteria/NCT06234930_criteria.json:3`. | Duplicates appear when quick + linewise passes both emit clauses (`NCT06234930` ends up with two age rows). | Unique, stable identifiers derived from source clause plus operator. |
| `type` | `"inclusion"` / `"exclusion"` (variants normalized in adapter). | Some parser outputs `"include"`/`"exclude"`; adapter coerces but should be avoided. | Strict enum to minimize adapter tolerance logic. |
| `category` | Free-text buckets from parser or synthetic injection (`diagnosis`, `ability`, `Eligibility`). | Mixed casing & vague categories hamper prioritization heuristics. | Controlled vocabulary aligned with UX groupings (demographics, safety, therapy, logistics, etc.). |
| `source` | `"patient"` or `"site"`; synthetic basics always `"patient"`. | UI no longer filters by source, so site-only clauses still surface even when impossible to self-answer. | Preserve but add semantic flag (`askable: boolean`) that UI can honor. |
| `question_text` | Sometimes patient-friendly; often null; duplicates common (`NCT06206265_1` & `_2`). | When blank the adapter fabricates a yes/no label even for quantitative rules, risking ambiguity. | Require patient-ready phrasing or provide separate `prompt_template` metadata. |
| `internal_description` | Rich prose excerpt from CT.gov, frequently long. | Not surfaced anywhere; missing opportunity for tooltips or “why we ask.” | Limit to concise rationale (<200 chars) and expose as helper copy. |
| `rule.variable` | Parser alternates between `variable` and `field`; adapter inspects both. | Non-standard terms (`"MoCA score"` strings, slug arrays) reduce automatic detection of numeric vs categorical. | Provide normalized `normalized_field` plus original `verbatim_field`. |
| `rule.operator` | Strings such as `">="`, `"<="`, `"between"`, `"is"`, `"in"`. | `"between"` sometimes paired with string `"50-90"` instead of numeric tuple, so adapter can’t emit range metadata (`NCT06234930` line 9). | Constrain to validated enum with operator-specific payloads. |
| `rule.value` | Heterogeneous (numbers, strings, arrays, null). | Stringified ranges and capitalized arrays hinder UI/Evaluator parity; null values collapse to boolean fallback. | Enforce type via schema: numbers for numeric ops, arrays for set ops, booleans for “is”. |
| `critical` | Present on a minority of clauses (e.g., synthetic organ-system exclusion). | Screener treats all inclusions as “required” regardless; `critical` loses nuance. | Use `critical` + `severity` to drive gating & progress weight. |
| `provenance` | Parser supplies `source`, `confidence`, `evidence`. | Currently ignored in UI; valuable for debugging & transparency. | Surface as optional dev/debug view; store but avoid shipping to client unless needed. |

### Real-World Samples
- `NCT06234930` (Alzheimer’s study) – rich narrative clauses, string-based ranges, heavy duplication, many `rule: null` entries that devolve into boolean yes/no questions (`data_engine/out/criteria/NCT06234930_criteria.json:1`).
- `NCT06206265` (IBS) – parser emits separate min/max rules for age but BMI criterion lacks a rule despite structured wording, so the UI cannot enforce 18.5–29.9 (`data_engine/out/criteria/NCT06206265_criteria.json:38`).
- Older studies such as `NCT00001159` show entirely narrative inclusions/exclusions with `rule: null`, stressing the adapter’s fallback pathways (`data_engine/out/criteria/NCT00001159_criteria.json:1`).

## Question Type Matrix

| Criterion Pattern | UI Control (`Screener.tsx:468`) | Validation (`Screener.tsx:126`) | Skip / Flow | Copy & Helper Source |
| --- | --- | --- | --- | --- |
| No rule or boolean-style operator (`is`, `is_not`) | Two-button yes/no toggle | Required for inclusions/critical; optional otherwise; string answers coerced to boolean (`getValidationSchema`) | `Skip` & `I’m not sure` allowed but block final evaluation because inclusions must be `provided` (`Screener.tsx:396`). | Label from `toPatientLabel`; tooltip from `phrasebook` when terms found (`Screener.tsx:470`). |
| Numeric with `>=` / `<=` | Single number input | Min/max derived from operator & value; non-numeric rejected (`makeNumberSchema`) | No unit hints; user guesswork for pounds vs kg. | Label from phrasebook; `helperText` (e.g., “We’ll check if ≥ X”) computed but never rendered. |
| Numeric `between` | Same as numeric | Only lower bound enforced because adapter captures first value and evaluator checks `>=` only (`evaluator.ts:91`). | Upper bound invisible; user sees narrative question or fallback. | No hint text—range lost. |
| Choice with ≤4 options | Multi-select pill buttons (behaves like checkbox group). | Required choices must include at least one selection. | No auto-progression; user must click “Save answer.” | Labels copied verbatim from options array. |
| Choice with >4 options | Native `<select>` single-choice | Same as above; multi-select not supported even when array implies multi. | Skipping leaves blank; evaluation sees single answer. | Options surfaced but no categorization or grouping. |
| Organizer exclusions merged by `normalize` | Multi-select for merged organ systems (`normalize.ts:66`). | Marked `critical` so cannot be skipped. | Consolidates many boolean questions into one multi-select; evaluation still expects individual criterion IDs, so merge only affects UI. | Static label (“Have you been diagnosed…”) and tooltip from phrasebook. |
| Remaining questions beyond `maxItems=8` | **Dropped from UI** (returned in `more` bucket, but not rendered anywhere). | N/A | Results default to “unknown” for every unseen clause; evaluation score penalized but user never saw the question. | Hidden from UX; only accessible via debug toggle. |

## Current Issues & Risks

- **Empathy**
  - Helper copy (`helperText`, `tooltip`) generated in `toPatientLabel` is discarded during rendering; patients see instructions like “Enter a number” with no context (`frontend/components/Screener.tsx:470`).
  - Affirmation panel triggers only after “Save answer,” so sensitive answers still get generic copy; we don’t surface “why we ask” up front.
  - “I’m not sure” immediately shifts to evaluation-ready state but still blocks final submission with a scolding error (“We need these required details”) instead of guiding the user (`Screener.tsx:396`).

- **Accuracy**
  - Only the top eight normalized questions are shown; all others remain unanswered → evaluator marks them `unknown`, depressing scores and hiding hard exclusions (`normalize.ts:138` + `Screener.tsx:191`).
  - `between` ranges reduce to a single lower bound in both UI and evaluator, so users who are over an upper limit still pass (`frontend/lib/matching/evaluator.ts:91`).
  - Parser frequently leaves quantitative criteria without structured `rule` payloads (e.g., BMI example above), so the UI poses yes/no questions without numeric enforcement.

- **Performance**
  - Typical `criteria_json` payloads are 10–18 KB (`wc -c` samples above). We deserialize and run `normalizeQuestionnaire` on every render; while memoized, the initial cost is noticeable on mobile.
  - Evaluation waits until the final step and adds an artificial 400 ms delay (`Screener.tsx:412`), making completion feel sluggish without any actual async work.

- **Privacy & Compliance**
  - Screener answers persist in `localStorage` per trial without encryption (`Screener.tsx:220`), creating residual PHI on shared devices.
  - When a user submits interest, we send the full answer map as plain JSON in `prefill.answers_json` to `/api/leads` (`ScreenResult.tsx:335` → `frontend/components/LeadForm.tsx:101`), storing it unencrypted even though the table targets PII-protected context.
  - Minor dev-only `console.log` of lead IDs exists (`ScreenResult.tsx:102`), but no raw PHI logging detected.

- **Maintainability**
  - Adapter contains inline console assertions/logs executed on the server build (`frontend/lib/criteria/adapter.ts:448`), causing noisy output and masking true test coverage gaps.
  - There are Jest suites for adapter and normalization, but no automated coverage for `evaluateTrial` or the Screener’s branching rules, leaving core scoring untested.

## Prioritized Improvement Plan

### Track A – Copy & Flow (low/no-risk)

| Item | Rationale | Risk | Files to Touch | Tests to Add | Rollback Plan |
| --- | --- | --- | --- | --- | --- |
| 1. Surface “why we ask” and helper text inline before answer entry. | Phrasebook already produces empathetic helper copy; showing it early sets context and reduces anxiety (`Screener.tsx:191`). | No-risk | `frontend/components/Screener.tsx`, `frontend/lib/criteria/phrasebook.ts` (ensure helper text available). | Extend existing React Testing Library scenario to assert helper text render. | Feature flag render block so we can toggle off in case of negative feedback. |
| 2. Replace blocking error on missing required answers with step-level coaching. | Current message feels punitive; a gentle nudge keeps users engaged (`Screener.tsx:396`). | No-risk | `frontend/components/Screener.tsx`. | Update Screener unit test to snapshot the new message. | Wrap copy in config constant to revert quickly if needed. |
| 3. Add empathetic intro that sets expectations on length and data use. | Presently only a short blurb; clarifying “eight quick questions” + privacy reassurance improves trust (`Screener.tsx:175`). | No-risk | `frontend/components/Screener.tsx`. | Snapshot test of header to ensure copy renders. | Maintain previous copy in translation file for quick reversion. |

### Track B – Product & Code Enhancements (low/medium risk)

| Item | Rationale | Risk | Files to Touch | Tests to Add | Rollback Plan |
| --- | --- | --- | --- | --- | --- |
| 1. Normalize numeric ranges and enforce both bounds in evaluator. | Fixes false positives where upper limits are ignored (`adapter.ts:265`, `evaluator.ts:91`). | Medium (changes eligibility outcomes). | `frontend/lib/criteria/adapter.ts`, `frontend/lib/matching/evaluator.ts`, add shared helpers. | New Jest tests covering `between` and inclusive ranges; regression tests for edge cases. | Guard behind feature flag `SCREENER_RANGE_FIX`; revert flag if partner feedback signals regression. |
| 2. Render the `more` question bucket via expandable accordion and ensure evaluator gating includes high-priority items. | Prevents silently skipping >8 criteria and reduces “unknown” noise. | Medium | `frontend/components/Screener.tsx`, optionally `frontend/lib/criteria/normalize.ts` to mark priorities. | RTL test verifying accordion toggles and evaluator receives answers from both sets. | Keep old path behind boolean prop; flip back if completion rates drop. |
| 3. Convert narrative criteria to structured rules during ingestion when patterns are obvious (BMI, ranges). | Parsing gap currently forces yes/no questions. | Medium (parser changes propagate to all trials). | `data_engine/parse_trial.py` (enhance `quick_extract_basic`), add targeted helper. | Pytest covering BMI, MoCA, range detection; fixture updates. | Feature flag extraction rule to disable if anomalies appear. |
| 4. Encrypt or omit `answers_json` in lead submissions; instead store hashed summary. | Current flow stores potentially sensitive health data unencrypted (`LeadForm.tsx:101`). | Low | `frontend/components/LeadForm.tsx`, `frontend/app/api/leads/route.ts`, Supabase schema migration. | API integration test ensuring encrypted payload written; unit test that redact helper returns expected structure. | Back up current column; keep decryption utility for rollback within maintenance window. |
| 5. Remove artificial evaluation delay and memoize analytics payload. | Shortens perceived latency and reduces UI jank without altering logic (`Screener.tsx:412`). | Low | `frontend/components/Screener.tsx`, `frontend/lib/analytics.ts`. | RTL test to assert immediate transition to results. | Reintroduce delay behind optional config if metrics show drop in satisfaction. |

## Test Plan Additions
- **Unit / Integration**
  - `frontend/lib/matching/evaluator.test.ts`: cover min/max/between, choice arrays, and exclusion precedence.
  - `frontend/components/__tests__/Screener.test.tsx`: simulate multi-step flow with `react-hook-form`-style events, ensure accordion paths work, and assert localStorage interactions stay scoped per trial.
  - `data_engine/tests/test_parse_trial.py`: fixtures for BMI/range detection to guarantee normalized `rule.value`.
- **Playwright Scenario**
  1. Navigate to `/trials`, click “Check eligibility” on a publishable trial.
  2. Answer a required inclusion, skip a non-critical, choose “I’m not sure” for one, and open the “more questions” accordion.
  3. Submit, verify result banner + breakdown, open lead form, and confirm encrypted payload via mocked API response.

## Guardrails Checklist
- [ ] Confirm `FEATURE_ALLOW_WRITES` gate remains enforced for any new lead or referral endpoints (`frontend/app/api/leads/route.ts:37`).
- [ ] Never log raw screener answers or lead details; scrub existing dev-only logs when polishing.
- [ ] Keep helper copy free of diagnoses unless already exposed by user input; avoid implying eligibility guarantees.
- [ ] Normalize units (lbs/kg, cm/in) before presenting or comparing values; display units with every numeric prompt.
- [ ] Ensure localStorage opt-in is communicated and provide “clear saved answers” control for shared devices.
- [ ] Keep analytics payloads limited to non-PHI fields (NCT ID, score bucket) and respect Do Not Track (`frontend/lib/analytics.ts:6`).
- [ ] Validate all inbound/outbound payloads with Zod (existing pattern) and add refinements where new fields appear.


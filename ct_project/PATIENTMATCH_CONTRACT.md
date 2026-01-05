PatientMatch: System Schema & Data Contract

Last Updated: December 24, 2025 | Version: 3.0 (v19 answerability trim)

1) Core Architecture
- Two repos, one database: ct_project builds DuckDB and pushes to Supabase; patientmatch serves from Supabase.
- Dataset-first: all schema changes and deterministic logic happen in ct_project (bronze/silver/gold) before push.
- No LLM: questionnaire generation is deterministic (rules + structured fields).

2) Build Pipeline (ct_project)
- refresh: sql/refresh.sql builds ref -> bronze -> silver -> gold.
- questionnaire build: scripts/build_pm_questionnaires.py writes gold.pm_questionnaires, gold.pm_trial_criteria, silver.eligibility_atoms.
- insights build: scripts/build_pm_trial_insights.py writes gold.pm_trial_insights.
- push: scripts/push_to_supabase.py upserts into Supabase public tables.

Active pipeline version (current):
- pmq_v19_answerability_trim_2025_12_24

3) Deterministic Questionnaire Generation
Source text flow:
- silver.eligibilities.eligibility_text_clean
- pmq/eligibility_parser.py (sections + bullets + hybrid fallback)
- pmq/atoms.py (EligibilityAtom matches per rule)
- pmq/rules.py (DEFAULT_RULES -> ExtractedCriterion)
- pmq/generator.py (structured + criteria -> questionnaire_json)

Key behaviors:
- criteria_json is now a wrapper: {"criteria":[...], "stats":{...}}
- gold.pm_trial_criteria_norm normalizes criteria_json for SQL.
- optional_questions exists; profile questions can be demoted with --profile-in-main false.
- window mismatch flagged via quality_flags + extraction_metrics.
- unknown question keys fail builds unless --allow-unknown-keys.

Question bank guardrails (pmq/question_bank.py):
- lint_question_bank_vs_rules (rules -> QUESTION_BANK coverage)
- template placeholder validation + safe fallback
- answerability metadata: patient | records | clinician
- unknown_policy and strength metadata for future ranking/audits

4) DuckDB Tables (Source of Truth)
Silver
- silver.eligibilities: eligibility_text_clean, eligibility_hash, gender, min_age_years, max_age_years.
- silver.eligibility_atoms: persisted atoms (nct_id, pipeline_version, rule_id, params_json, evidence).

Gold
- gold.pm_trials: filtered trials mart for PatientMatch.
- gold.pm_trials_serving: serving view used for push.
- gold.pm_trial_sites: site rows (used for trial_sites).
- gold.pm_trial_criteria: criteria_json (wrapped) + coverage stats.
- gold.pm_trial_criteria_norm: view with criteria_list_json + criteria_stats_json.
- gold.pm_questionnaires: questionnaire_json + quality_score/flags/readiness.
- gold.pm_trial_insights: deterministic insights from atoms + questionnaire.

Eval
- eval.pm_questionnaire_eval: aggregate snapshot by pipeline_version.

5) Supabase public Tables (Serving)
trials
- nct_id (PK), title, sponsor, phase, status, status_bucket, gender
- minimum_age, maximum_age, conditions (text[])
- questionnaire_json (jsonb), quality_score, quality_flags
- readiness (boolean in Supabase; pushed as True for High, False for Medium/Low)
- build_tag (pipeline_version string)

trial_sites
- nct_id, site_key (PK), facility_name, city, state_code, zip5
- geom (geography), lat, lon, accuracy

trial_insights
- nct_id (PK), pipeline_version, input_hash
- strictness_score, burden_score, novelty_score, logistics_score
- top_disqualifiers_json, insights_flags_json, plain_summary_json

zip_centroids
- zip, lat, lon, state_code

6) Supabase Push Contract
Script: scripts/push_to_supabase.py
- Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.
- Schema-aware filtering via OpenAPI; drops unknown columns before upsert.
- Coerces types based on Supabase schema (e.g., readiness boolean).
- Upserts by nct_id for trials + trial_insights, and (nct_id,site_key) for trial_sites.

Recommended full push (v19):
python scripts/push_to_supabase.py \
  --build_tag pmq_v19_answerability_trim_2025_12_24 \
  --mode permissive \
  --limit 0

Optional flags:
- --no-push_sites (skip trial_sites)
- --refresh_schema_cache (pull latest OpenAPI schema)
- --strict_schema (fail if columns are dropped)

7) UI & Logic Constraints
- Use nct_id as the join key everywhere.
- Show at most one site per trial (nearest).
- optional_questions may contain profile keys when profile_in_main=false.
- questionnaire_json structure:
  - questions, optional_questions
  - question_count_total, optional_question_count
  - extraction_metrics: atom_count, criteria_count, tier1/2_count, window_mismatch_count, criteria_in_optional_count

8) Coding Agent Guidance
- Treat this file as the source of truth for schema and push behavior.
- Do not assume criteria_json is a list; use gold.pm_trial_criteria_norm or pmq/criteria_io.py.
- When updating question keys or rules, run the question bank lints and keep build_tag in sync with pipeline_version.

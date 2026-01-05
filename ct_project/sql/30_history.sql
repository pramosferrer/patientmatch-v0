-- 30_history.sql
-- Appends a thin monthly snapshot of Gold PatientMatch trials.
-- This preserves history without storing raw AACT dumps.

CREATE OR REPLACE MACRO raw_dir() AS '/ct_project/rawdata/current';
CREATE OR REPLACE MACRO ref_dir() AS '/ct_project/ref';

CREATE SCHEMA IF NOT EXISTS history;

-- Create the snapshot table once (append-only afterwards)
CREATE TABLE IF NOT EXISTS history.pm_trial_snapshot (
  as_of_month DATE NOT NULL,
  nct_id VARCHAR NOT NULL,

  status_norm VARCHAR,
  status_bucket VARCHAR,
  is_open_for_enrollment BOOLEAN,

  site_count_us INTEGER,
  states_list VARCHAR[],

  phase VARCHAR,
  study_type VARCHAR,

  condition_slugs VARCHAR[],

  eligibility_hash VARCHAR,

  aact_last_update_date DATE,
  data_as_of_date DATE,

  inserted_at TIMESTAMP DEFAULT now()
);

WITH params AS (
  SELECT cast(date_trunc('month', current_date) AS DATE) AS as_of_month
)
INSERT INTO history.pm_trial_snapshot (
  as_of_month,
  nct_id,
  status_norm,
  status_bucket,
  is_open_for_enrollment,
  site_count_us,
  states_list,
  phase,
  study_type,
  condition_slugs,
  eligibility_hash,
  aact_last_update_date,
  data_as_of_date
)
SELECT
  p.as_of_month,
  t.nct_id,
  t.status_norm,
  t.status_bucket,
  t.is_open_for_enrollment,
  t.site_count_us,
  t.states_list,
  t.phase,
  t.study_type,
  t.condition_slugs,
  t.eligibility_hash,
  t.aact_last_update_date,
  t.data_as_of_date
FROM gold.pm_trials t
CROSS JOIN params p
WHERE NOT EXISTS (
  SELECT 1
  FROM history.pm_trial_snapshot h
  WHERE h.as_of_month = p.as_of_month
    AND h.nct_id = t.nct_id
);

CHECKPOINT;

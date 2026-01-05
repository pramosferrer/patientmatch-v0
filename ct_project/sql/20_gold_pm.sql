-- 20_gold_pm.sql
-- Builds PatientMatch-serving Gold marts from Silver.
-- Gold is small, filtered, and UI-ready.

CREATE OR REPLACE MACRO raw_dir() AS '/ct_project/rawdata/current';
CREATE OR REPLACE MACRO ref_dir() AS '/ct_project/ref';

CREATE SCHEMA IF NOT EXISTS gold;

-- 1) Site summary (simple, patient-friendly)
CREATE OR REPLACE TABLE gold.pm_site_summary AS
SELECT
  nct_id,
  count(DISTINCT site_key) FILTER (WHERE is_us_site) AS site_count_us,

  list_sort(
    list_distinct(
      list(trim(state_code)) FILTER (WHERE is_us_site AND state_code IS NOT NULL AND trim(state_code) <> '')
    )
  ) AS states_list

FROM silver.sites
GROUP BY 1;

-- 2) Trial sites with ZIP centroids (US only)
CREATE OR REPLACE TABLE gold.pm_trial_sites AS
WITH base AS (
  SELECT
    nct_id,
    site_key,
    facility_name,
    city,
    state_code,
    postal_code AS zip_raw,
    regexp_extract(postal_code, '([0-9]{5})', 1) AS zip5
  FROM silver.sites
  WHERE is_us_site = true
)
SELECT
  b.nct_id,
  b.site_key,
  b.facility_name,
  b.city,
  b.state_code,
  b.zip_raw,
  b.zip5,
  z.lat,
  z.lon,
  'SRID=4326;POINT(' || z.lon || ' ' || z.lat || ')' AS geom_wkt,
  z.accuracy
FROM base b
LEFT JOIN ref.us_zip_centroids z
  ON b.zip5 = z.zip;

-- 3) Aggregate conditions + interventions for display/filtering
CREATE OR REPLACE VIEW gold._pm_conditions_agg AS
SELECT
  nct_id,
  list_sort(list_distinct(list(canonical_slug))) AS condition_slugs,
  list_sort(list_distinct(list(canonical_display_name))) AS conditions_display
FROM silver.conditions
GROUP BY 1;

CREATE OR REPLACE VIEW gold._pm_interventions_agg AS
SELECT
  nct_id,
  list_sort(list_distinct(list(intervention_name_raw))) AS interventions_display
FROM silver.interventions
GROUP BY 1;

CREATE OR REPLACE VIEW gold._pm_sponsor_agg AS
SELECT
  nct_id,
  coalesce(
    max(case when lead_or_collaborator = 'lead' then sponsor_name end),
    min(sponsor_name)
  ) AS lead_sponsor_name
FROM silver.sponsors
GROUP BY 1;

-- 4) PatientMatch trials mart
CREATE OR REPLACE TABLE gold.pm_trials AS
WITH base AS (
  SELECT
    st.nct_id,
    'https://clinicaltrials.gov/study/' || st.nct_id AS trial_url,

    st.title,
    st.brief_title,
    st.official_title,

    st.study_type,
    st.phase,

    st.overall_status_raw AS status,
    st.status_norm,
    st.status_bucket,
    st.is_open_for_enrollment,

    st.start_date,
    st.completion_date,
    st.aact_last_update_date,
    st.data_as_of_date,

    -- Patient fast filters
    st.gender,
    st.minimum_age,
    st.maximum_age,
    st.min_age_years,
    st.max_age_years,
    st.healthy_volunteers,

    -- Eligibility fingerprints
    st.eligibility_hash,
    st.eligibility_text_clean,

    -- Sites
    ss.site_count_us,
    ss.states_list,

    -- Conditions / interventions
    ca.condition_slugs,
    ca.conditions_display,
    ia.interventions_display,
    sp.lead_sponsor_name,

    -- Readiness helpers
    st.adult AS adult,
    st.child AS child,
    st.status_unmapped AS status_unmapped
  FROM silver.studies st
  LEFT JOIN gold.pm_site_summary ss
    ON st.nct_id = ss.nct_id
  LEFT JOIN gold._pm_conditions_agg ca
    ON st.nct_id = ca.nct_id
  LEFT JOIN gold._pm_interventions_agg ia
    ON st.nct_id = ia.nct_id
  LEFT JOIN gold._pm_sponsor_agg sp
    ON st.nct_id = sp.nct_id
  WHERE
    -- PatientMatch filters (Gold is opinionated)
    coalesce(ss.site_count_us, 0) > 0
    AND st.is_open_for_enrollment = true
    AND lower(coalesce(trim(st.study_type), '')) = 'interventional'
),
scored AS (
  SELECT
    base.*,
    (
      CASE WHEN (gender IS NULL OR trim(gender) = '') THEN 1 ELSE 0 END
      + CASE
          WHEN (min_age_years IS NULL AND coalesce(adult, false) = false AND coalesce(child, false) = false) THEN 1
          ELSE 0
        END
      + CASE WHEN (condition_slugs IS NULL OR array_length(condition_slugs) = 0) THEN 1 ELSE 0 END
      + CASE WHEN (coalesce(site_count_us, 0) <= 0) THEN 1 ELSE 0 END
      + CASE WHEN (coalesce(is_open_for_enrollment, false) = false) THEN 1 ELSE 0 END
    ) AS pm_missing_key_count,
    (eligibility_text_clean IS NULL OR trim(eligibility_text_clean) = '') AS pm_missing_eligibility_text,
    list_filter([
      CASE WHEN (gender IS NULL OR trim(gender) = '') THEN 'missing_gender' ELSE NULL END,
      CASE
        WHEN (min_age_years IS NULL AND coalesce(adult, false) = false AND coalesce(child, false) = false) THEN 'missing_age'
        ELSE NULL
      END,
      CASE WHEN (condition_slugs IS NULL OR array_length(condition_slugs) = 0) THEN 'missing_conditions' ELSE NULL END,
      CASE WHEN (coalesce(site_count_us, 0) <= 0) THEN 'missing_sites' ELSE NULL END,
      CASE WHEN (coalesce(is_open_for_enrollment, false) = false) THEN 'missing_open_status' ELSE NULL END,
      CASE WHEN (coalesce(status_unmapped, false) = true) THEN 'missing_status_mapping' ELSE NULL END,
      CASE WHEN (eligibility_text_clean IS NULL OR trim(eligibility_text_clean) = '') THEN 'missing_eligibility_text' ELSE NULL END
    ], x -> x IS NOT NULL) AS pm_quality_flags
  FROM base
)
SELECT
  nct_id,
  trial_url,

  title,
  brief_title,
  official_title,

  study_type,
  phase,

  status,
  status_norm,
  status_bucket,
  is_open_for_enrollment,

  start_date,
  completion_date,
  aact_last_update_date,
  data_as_of_date,

  gender,
  minimum_age,
  maximum_age,
  min_age_years,
  max_age_years,
  healthy_volunteers,

  eligibility_hash,
  eligibility_text_clean,

  site_count_us,
  states_list,

  condition_slugs,
  conditions_display,
  interventions_display,
  lead_sponsor_name,

  CASE
    WHEN pm_missing_eligibility_text THEN 'Low'
    WHEN pm_missing_key_count >= 2 THEN 'Low'
    WHEN pm_missing_key_count = 0 THEN 'High'
    WHEN pm_missing_key_count = 1 AND eligibility_hash IS NOT NULL THEN 'Medium'
    ELSE 'Low'
  END AS pm_readiness,
  pm_quality_flags
FROM scored;

CREATE OR REPLACE VIEW gold.pm_trials_serving AS
SELECT
  nct_id,
  trial_url,
  title,
  phase,
  status,
  status_norm,
  status_bucket,
  gender,
  minimum_age,
  maximum_age,
  min_age_years,
  max_age_years,
  conditions_display,
  condition_slugs,
  interventions_display,
  lead_sponsor_name,
  site_count_us,
  states_list,
  eligibility_hash,
  pm_readiness,
  pm_quality_flags,
  aact_last_update_date,
  data_as_of_date
FROM gold.pm_trials;

CHECKPOINT;

-- Verification:
-- SELECT count(*) AS n FROM gold.pm_trial_sites;
-- SELECT
--   100.0 * count(*) FILTER (WHERE lat IS NOT NULL AND lon IS NOT NULL) / NULLIF(count(*), 0) AS pct_with_coords
-- FROM gold.pm_trial_sites;
-- SELECT * FROM gold.pm_trial_sites WHERE state_code = 'MA' LIMIT 5;

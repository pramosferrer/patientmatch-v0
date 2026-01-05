-- 10_silver.sql
-- Builds canonical, cleaned Silver tables from Bronze + ref dictionaries.
-- This is where the DuckDB file grows (materialized tables).

CREATE OR REPLACE MACRO raw_dir() AS '/ct_project/rawdata/current';
CREATE OR REPLACE MACRO ref_dir() AS '/ct_project/ref';

CREATE SCHEMA IF NOT EXISTS silver;

-- Helper: canonical slugify for conditions
-- (Expression only; used in SELECTs)
-- lower -> replace non-alnum with '-' -> trim leading/trailing '-'
-- NOTE: Keep this consistent with how you generated raw_slug in condition_aliases.csv

-- 1) Silver eligibilities (deduped to 1 row per nct_id; cleaned; parsed ages; hashed criteria)
CREATE OR REPLACE TABLE silver.eligibilities AS
WITH base AS (
  SELECT
    trim(id) AS eligibility_id,
    trim(nct_id) AS nct_id,

    trim(sampling_method) AS sampling_method,

    trim(gender) AS gender,
    trim(minimum_age) AS minimum_age_raw,
    trim(maximum_age) AS maximum_age_raw,

    trim(healthy_volunteers) AS healthy_volunteers_raw,
    trim(population) AS population,

    criteria AS eligibility_text_raw,

    trim(gender_description) AS gender_description,
    trim(gender_based) AS gender_based_raw,

    trim(adult) AS adult_raw,
    trim(child) AS child_raw,
    trim(older_adult) AS older_adult_raw
  FROM bronze.eligibilities
  WHERE nct_id IS NOT NULL AND trim(nct_id) <> ''
),
dedup AS (
  SELECT *
  FROM (
    SELECT
      *,
      row_number() OVER (
        PARTITION BY nct_id
        ORDER BY try_cast(eligibility_id AS BIGINT) DESC NULLS LAST
      ) AS rn
    FROM base
  )
  WHERE rn = 1
),
parsed AS (
  SELECT
    eligibility_id,
    nct_id,
    sampling_method,
    gender,
    minimum_age_raw,
    maximum_age_raw,

    CASE
      WHEN lower(trim(healthy_volunteers_raw)) IN ('t','true','1','yes','y') THEN true
      WHEN lower(trim(healthy_volunteers_raw)) IN ('f','false','0','no','n') THEN false
      ELSE NULL
    END AS healthy_volunteers,

    population,
    eligibility_text_raw,

    gender_description,

    CASE
      WHEN lower(trim(gender_based_raw)) IN ('t','true','1','yes','y') THEN true
      WHEN lower(trim(gender_based_raw)) IN ('f','false','0','no','n') THEN false
      ELSE NULL
    END AS gender_based,

    CASE
      WHEN lower(trim(adult_raw)) IN ('t','true','1','yes','y') THEN true
      WHEN lower(trim(adult_raw)) IN ('f','false','0','no','n') THEN false
      ELSE NULL
    END AS adult,

    CASE
      WHEN lower(trim(child_raw)) IN ('t','true','1','yes','y') THEN true
      WHEN lower(trim(child_raw)) IN ('f','false','0','no','n') THEN false
      ELSE NULL
    END AS child,

    CASE
      WHEN lower(trim(older_adult_raw)) IN ('t','true','1','yes','y') THEN true
      WHEN lower(trim(older_adult_raw)) IN ('f','false','0','no','n') THEN false
      ELSE NULL
    END AS older_adult,

    -- Parse age numbers + units
    try_cast(regexp_extract(minimum_age_raw, '([0-9]+)', 1) AS DOUBLE) AS min_age_num,
    regexp_extract(lower(minimum_age_raw), '(year|years|month|months|week|weeks|day|days|hour|hours|minute|minutes)', 1) AS min_age_unit,

    try_cast(regexp_extract(maximum_age_raw, '([0-9]+)', 1) AS DOUBLE) AS max_age_num,
    regexp_extract(lower(maximum_age_raw), '(year|years|month|months|week|weeks|day|days|hour|hours|minute|minutes)', 1) AS max_age_unit
  FROM dedup
),
ages AS (
  SELECT
    *,

    CASE
      WHEN minimum_age_raw IS NULL OR trim(minimum_age_raw) = '' THEN NULL
      WHEN upper(trim(minimum_age_raw)) IN ('N/A','NA') THEN NULL
      WHEN min_age_num IS NULL THEN NULL
      WHEN min_age_unit LIKE 'year%' THEN min_age_num
      WHEN min_age_unit LIKE 'month%' THEN min_age_num / 12.0
      WHEN min_age_unit LIKE 'week%' THEN min_age_num / 52.1429
      WHEN min_age_unit LIKE 'day%' THEN min_age_num / 365.2425
      WHEN min_age_unit LIKE 'hour%' THEN min_age_num / (24.0 * 365.2425)
      WHEN min_age_unit LIKE 'minute%' THEN min_age_num / (60.0 * 24.0 * 365.2425)
      ELSE NULL
    END AS min_age_years,

    CASE
      WHEN maximum_age_raw IS NULL OR trim(maximum_age_raw) = '' THEN NULL
      WHEN upper(trim(maximum_age_raw)) IN ('N/A','NA') THEN NULL
      WHEN max_age_num IS NULL THEN NULL
      WHEN max_age_unit LIKE 'year%' THEN max_age_num
      WHEN max_age_unit LIKE 'month%' THEN max_age_num / 12.0
      WHEN max_age_unit LIKE 'week%' THEN max_age_num / 52.1429
      WHEN max_age_unit LIKE 'day%' THEN max_age_num / 365.2425
      WHEN max_age_unit LIKE 'hour%' THEN max_age_num / (24.0 * 365.2425)
      WHEN max_age_unit LIKE 'minute%' THEN max_age_num / (60.0 * 24.0 * 365.2425)
      ELSE NULL
    END AS max_age_years
  FROM parsed
),
cleaned AS (
  SELECT
    eligibility_id,
    nct_id,
    sampling_method,
    gender,
    minimum_age_raw,
    maximum_age_raw,
    minimum_age_raw AS minimum_age,
    maximum_age_raw AS maximum_age,
    min_age_years,
    max_age_years,
    healthy_volunteers,
    population,
    gender_description,
    gender_based,
    adult,
    child,
    older_adult,
    eligibility_text_raw,

    -- Conservative deterministic cleaning:
    -- 1) normalize CRLF to LF
    -- 2) collapse tabs/spaces
    -- 3) collapse 3+ newlines to 2
    -- 4) trim
    trim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            coalesce(eligibility_text_raw, ''),
            '\r\n', '\n', 'g'
          ),
          '[ \t]+', ' ', 'g'
        ),
        '\n{3,}', '\n\n', 'g'
      )
    ) AS eligibility_text_clean
  FROM ages
)
SELECT
  *,
  md5(eligibility_text_clean) AS eligibility_hash
FROM cleaned;

-- 2) Silver studies (merge studies + eligibilities; normalize status using ref.status_map)
CREATE OR REPLACE TABLE silver.studies AS
WITH s AS (
  SELECT
    trim(nct_id) AS nct_id,

    trim(brief_title) AS brief_title,
    trim(official_title) AS official_title,

    trim(study_type) AS study_type,
    trim(phase) AS phase,

    trim(overall_status) AS overall_status_raw,

    try_cast(trim(start_date) AS DATE) AS start_date,
    try_cast(trim(completion_date) AS DATE) AS completion_date,

    -- Prefer submitted; fall back to posted (both exist in most AACT dumps)
    coalesce(
      try_cast(trim(last_update_submitted_date) AS DATE),
      try_cast(trim(last_update_posted_date) AS DATE)
    ) AS aact_last_update_date
  FROM bronze.studies
  WHERE nct_id IS NOT NULL AND trim(nct_id) <> ''
),
status_enriched AS (
  SELECT
    s.*,
    upper(
      regexp_replace(
        replace(coalesce(s.overall_status_raw, ''), '_', ' '),
        '\s+',
        ' ',
        'g'
      )
    ) AS status_norm,

    coalesce(sm.status_bucket, 'UNKNOWN') AS status_bucket,
    coalesce(sm.is_open_for_enrollment, false) AS is_open_for_enrollment,

    CASE
      WHEN sm.raw_status_norm IS NULL AND s.overall_status_raw IS NOT NULL AND trim(s.overall_status_raw) <> '' THEN true
      ELSE false
    END AS status_unmapped
  FROM s
  LEFT JOIN ref.status_map sm
    ON normalize_status(s.overall_status_raw) = sm.raw_status_norm
),
merged AS (
  SELECT
    se.nct_id,

    -- Deterministic title preference
    coalesce(nullif(se.brief_title, ''), nullif(se.official_title, '')) AS title,
    se.brief_title,
    se.official_title,

    se.study_type,
    se.phase,

    se.overall_status_raw,
    se.status_norm,
    se.status_bucket,
    se.is_open_for_enrollment,
    se.status_unmapped,

    se.start_date,
    se.completion_date,
    se.aact_last_update_date,

    current_date AS data_as_of_date,

    -- Eligibility-derived patient filters (canonical source)
    e.gender AS gender,
    e.minimum_age_raw,
    e.maximum_age_raw,
    e.minimum_age,
    e.maximum_age,
    e.min_age_years,
    e.max_age_years,
    e.healthy_volunteers,
    e.adult,
    e.child,
    e.older_adult,

    -- Eligibility text + hash
    e.eligibility_text_raw,
    e.eligibility_text_clean,
    e.eligibility_hash
  FROM status_enriched se
  LEFT JOIN silver.eligibilities e
    ON se.nct_id = e.nct_id
)
SELECT *
FROM merged;

-- 3) Silver sites (from facilities; stable site_key; robust US flag)
CREATE OR REPLACE TABLE silver.sites AS
WITH base AS (
  SELECT
    trim(nct_id) AS nct_id,

    trim(name) AS facility_name,
    trim(city) AS city,
    trim(state) AS state,
    trim(zip) AS postal_code,
    trim(country) AS country
  FROM bronze.facilities
  WHERE nct_id IS NOT NULL AND trim(nct_id) <> ''
),
norm AS (
  SELECT
    *,
    -- Normalize country to compare safely (remove non-letters)
    regexp_replace(lower(coalesce(country, '')), '[^a-z]', '', 'g') AS country_norm_clean,
    lower(trim(state)) AS state_lc,
    trim(state) AS state_trim
  FROM base
),
keyed AS (
  SELECT
    nct_id,
    facility_name,
    city,
    state,
    postal_code,
    country,
    country_norm_clean,
    CASE
      WHEN state_trim IS NULL OR state_trim = '' THEN NULL
      WHEN length(state_trim) = 2 THEN upper(state_trim)
      ELSE m.state_code
    END AS state_code,

    md5(
      lower(coalesce(facility_name, '')) || '|' ||
      lower(coalesce(city, '')) || '|' ||
      lower(coalesce(state, '')) || '|' ||
      lower(coalesce(postal_code, '')) || '|' ||
      lower(coalesce(country_norm_clean, ''))
    ) AS site_key,

    CASE
      WHEN country_norm_clean IN ('unitedstates','unitedstatesofamerica','usa','us') THEN true
      ELSE false
    END AS is_us_site
  FROM norm
  LEFT JOIN ref.us_state_map m
    ON norm.state_lc = m.state_name_lc
)
SELECT *
FROM keyed;

-- 4) Silver conditions (slugify + alias mapping to canonical)
CREATE OR REPLACE TABLE silver.conditions AS
WITH base AS (
  SELECT
    trim(nct_id) AS nct_id,
    trim(name) AS condition_name_raw
  FROM bronze.conditions
  WHERE nct_id IS NOT NULL AND trim(nct_id) <> ''
    AND name IS NOT NULL AND trim(name) <> ''
),
slugged AS (
  SELECT
    *,
    regexp_replace(
      regexp_replace(
        lower(trim(condition_name_raw)),
        '[^a-z0-9]+', '-', 'g'
      ),
      '(^-+|-+$)', '', 'g'
    ) AS raw_slug
  FROM base
),
aliased AS (
  SELECT
    s.nct_id,
    s.condition_name_raw,
    s.raw_slug,

    coalesce(a.canonical_slug, s.raw_slug) AS canonical_slug,
    coalesce(a.display_name, s.condition_name_raw) AS canonical_display_name,

    CASE WHEN a.canonical_slug IS NOT NULL THEN true ELSE false END AS is_aliased
  FROM slugged s
  LEFT JOIN ref.condition_aliases a
    ON s.raw_slug = a.raw_slug
)
SELECT *
FROM aliased;

-- 5) Silver interventions (keep raw + light normalized)
CREATE OR REPLACE TABLE silver.interventions AS
WITH base AS (
  SELECT
    trim(nct_id) AS nct_id,
    trim(intervention_type) AS intervention_type,
    trim(name) AS intervention_name_raw
  FROM bronze.interventions
  WHERE nct_id IS NOT NULL AND trim(nct_id) <> ''
    AND name IS NOT NULL AND trim(name) <> ''
)
SELECT
  nct_id,
  intervention_type,
  intervention_name_raw,
  regexp_replace(lower(intervention_name_raw), '\s+', ' ', 'g') AS intervention_name_norm
FROM base;

-- 6) Silver sponsors (lead/collaborator + agency name)
CREATE OR REPLACE TABLE silver.sponsors AS
SELECT
  trim(id) AS sponsor_id,
  trim(nct_id) AS nct_id,
  trim(agency_class) AS agency_class,
  lower(trim(lead_or_collaborator)) AS lead_or_collaborator,
  trim(name) AS sponsor_name
FROM bronze.sponsors
WHERE nct_id IS NOT NULL AND trim(nct_id) <> ''
  AND name IS NOT NULL AND trim(name) <> '';

CHECKPOINT;

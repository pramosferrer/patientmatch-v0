-- refresh.sql
-- End-to-end build: ref -> bronze -> silver -> gold -> history
-- Run this file to regenerate everything from /rawdata/current into gold.pm_trials and append monthly history.

-- ===== 00_ref.sql =====
-- Use project-relative paths so scripts work regardless of absolute location.
CREATE OR REPLACE MACRO raw_dir() AS 'rawdata/current';
CREATE OR REPLACE MACRO ref_dir() AS 'ref';

CREATE OR REPLACE MACRO normalize_status(s) AS
  lower(
    trim(
      regexp_replace(
        replace(coalesce(s, ''), '_', ' '),
        '\s+',
        ' ',
        'g'
      )
    )
  );

CREATE SCHEMA IF NOT EXISTS ref;

CREATE OR REPLACE TABLE ref.status_map AS
WITH src AS (
  SELECT *
  FROM read_csv_auto(
    ref_dir() || '/status_map.csv',
    header=true,
    delim=',',
    all_varchar=true
  )
),
clean AS (
  SELECT
    trim(raw_status) AS raw_status,
    normalize_status(raw_status) AS raw_status_norm,
    trim(standardized_status) AS status_bucket,
    CASE
      WHEN upper(trim(is_open)) IN ('TRUE','T','1','YES','Y') THEN true
      WHEN upper(trim(is_open)) IN ('FALSE','F','0','NO','N') THEN false
      ELSE false
    END AS is_open_for_enrollment
  FROM src
  WHERE raw_status IS NOT NULL AND trim(raw_status) <> ''
),
dedup AS (
  SELECT *
  FROM (
    SELECT
      *,
      row_number() OVER (PARTITION BY raw_status_norm ORDER BY raw_status) AS rn
    FROM clean
  )
  WHERE rn = 1
)
SELECT
  raw_status,
  raw_status_norm,
  status_bucket,
  is_open_for_enrollment
FROM dedup;

CREATE OR REPLACE TABLE ref.condition_aliases AS
WITH src AS (
  SELECT *
  FROM read_csv_auto(
    ref_dir() || '/condition_aliases.csv',
    header=true,
    delim=',',
    all_varchar=true
  )
),
clean AS (
  SELECT
    trim(raw_slug) AS raw_slug,
    trim(canonical_slug) AS canonical_slug,
    trim(display_name) AS display_name
  FROM src
  WHERE raw_slug IS NOT NULL AND trim(raw_slug) <> ''
),
dedup AS (
  SELECT *
  FROM (
    SELECT
      *,
      row_number() OVER (PARTITION BY raw_slug ORDER BY canonical_slug, display_name) AS rn
    FROM clean
  )
  WHERE rn = 1
)
SELECT
  raw_slug,
  canonical_slug,
  display_name
FROM dedup;

CREATE OR REPLACE TABLE ref.us_state_map AS
SELECT * FROM (VALUES
  ('alabama','AL'), ('alaska','AK'), ('arizona','AZ'), ('arkansas','AR'),
  ('california','CA'), ('colorado','CO'), ('connecticut','CT'), ('delaware','DE'),
  ('district of columbia','DC'),
  ('florida','FL'), ('georgia','GA'), ('hawaii','HI'), ('idaho','ID'),
  ('illinois','IL'), ('indiana','IN'), ('iowa','IA'), ('kansas','KS'),
  ('kentucky','KY'), ('louisiana','LA'), ('maine','ME'), ('maryland','MD'),
  ('massachusetts','MA'), ('michigan','MI'), ('minnesota','MN'), ('mississippi','MS'),
  ('missouri','MO'), ('montana','MT'), ('nebraska','NE'), ('nevada','NV'),
  ('new hampshire','NH'), ('new jersey','NJ'), ('new mexico','NM'), ('new york','NY'),
  ('north carolina','NC'), ('north dakota','ND'), ('ohio','OH'), ('oklahoma','OK'),
  ('oregon','OR'), ('pennsylvania','PA'), ('rhode island','RI'), ('south carolina','SC'),
  ('south dakota','SD'), ('tennessee','TN'), ('texas','TX'), ('utah','UT'),
  ('vermont','VT'), ('virginia','VA'), ('washington','WA'), ('west virginia','WV'),
  ('wisconsin','WI'), ('wyoming','WY')
) AS t(state_name_lc, state_code);

CREATE OR REPLACE TABLE ref.us_zip_centroids AS
SELECT
  country_code,
  zip,
  place_name,
  state_name,
  state_code,
  county_name,
  county_code,
  admin3_name,
  admin3_code,
  CAST(lat AS DOUBLE) AS lat,
  CAST(lon AS DOUBLE) AS lon,
  CAST(accuracy AS INTEGER) AS accuracy
FROM read_csv(
  ref_dir() || '/geonames/US.txt',
  delim='\t',
  header=false,
  columns={
    'country_code': 'VARCHAR',
    'zip': 'VARCHAR',
    'place_name': 'VARCHAR',
    'state_name': 'VARCHAR',
    'state_code': 'VARCHAR',
    'county_name': 'VARCHAR',
    'county_code': 'VARCHAR',
    'admin3_name': 'VARCHAR',
    'admin3_code': 'VARCHAR',
    'lat': 'VARCHAR',
    'lon': 'VARCHAR',
    'accuracy': 'VARCHAR'
  }
);

CREATE OR REPLACE VIEW ref._status_map_dupes AS
SELECT raw_status_norm, count(*) AS n
FROM ref.status_map
GROUP BY 1
HAVING count(*) > 1;

CREATE OR REPLACE VIEW ref._condition_alias_dupes AS
SELECT raw_slug, count(*) AS n
FROM ref.condition_aliases
GROUP BY 1
HAVING count(*) > 1;


-- ===== 01_bronze.sql =====
CREATE SCHEMA IF NOT EXISTS bronze;

CREATE OR REPLACE VIEW bronze.studies AS
SELECT *
FROM read_csv_auto(
  raw_dir() || '/studies.txt',
  header=true,
  delim='|',
  all_varchar=true
);

CREATE OR REPLACE VIEW bronze.facilities AS
SELECT *
FROM read_csv_auto(
  raw_dir() || '/facilities.txt',
  header=true,
  delim='|',
  all_varchar=true
);

CREATE OR REPLACE VIEW bronze.conditions AS
SELECT *
FROM read_csv_auto(
  raw_dir() || '/conditions.txt',
  header=true,
  delim='|',
  all_varchar=true
);

CREATE OR REPLACE VIEW bronze.interventions AS
SELECT *
FROM read_csv_auto(
  raw_dir() || '/interventions.txt',
  header=true,
  delim='|',
  all_varchar=true
);

CREATE OR REPLACE VIEW bronze.eligibilities AS
SELECT *
FROM read_csv_auto(
  raw_dir() || '/eligibilities.txt',
  header=true,
  delim='|',
  all_varchar=true
);

CREATE OR REPLACE VIEW bronze.sponsors AS
SELECT *
FROM read_csv_auto(
  raw_dir() || '/sponsors.txt',
  header=true,
  delim='|',
  all_varchar=true
);


-- ===== 10_silver.sql =====
CREATE SCHEMA IF NOT EXISTS silver;

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

    e.eligibility_text_raw,
    e.eligibility_text_clean,
    e.eligibility_hash
  FROM status_enriched se
  LEFT JOIN silver.eligibilities e
    ON se.nct_id = e.nct_id
)
SELECT *
FROM merged;

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


-- ===== 20_gold_pm.sql =====
CREATE SCHEMA IF NOT EXISTS gold;

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

    st.gender,
    st.minimum_age,
    st.maximum_age,
    st.min_age_years,
    st.max_age_years,
    st.healthy_volunteers,

    st.eligibility_hash,
    st.eligibility_text_clean,

    ss.site_count_us,
    ss.states_list,

    ca.condition_slugs,
    ca.conditions_display,
    ia.interventions_display,
    sp.lead_sponsor_name,

    st.adult AS adult,
    st.child AS child,
    st.status_unmapped AS status_unmapped
  FROM silver.studies st
  LEFT JOIN gold.pm_site_summary ss ON st.nct_id = ss.nct_id
  LEFT JOIN gold._pm_conditions_agg ca ON st.nct_id = ca.nct_id
  LEFT JOIN gold._pm_interventions_agg ia ON st.nct_id = ia.nct_id
  LEFT JOIN gold._pm_sponsor_agg sp ON st.nct_id = sp.nct_id
  WHERE
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


-- ===== 30_history.sql =====
CREATE SCHEMA IF NOT EXISTS history;

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

CREATE OR REPLACE VIEW gold.pm_trial_criteria_norm AS
SELECT
  nct_id,
  pipeline_version,
  eligibility_hash,
  coalesce(json_extract(criteria_json, '$.criteria'), criteria_json) AS criteria_list_json,
  json_extract(criteria_json, '$.stats') AS criteria_stats_json,
  total_bullets,
  covered_bullets,
  coverage_ratio,
  criteria_count,
  extracted_at
FROM gold.pm_trial_criteria;

CHECKPOINT;

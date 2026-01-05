-- 00_ref.sql
-- Loads small reference dictionaries (status mapping + condition aliases)
-- into DuckDB as durable tables under schema `ref`.

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

-- Load status map (clean + normalized join key)
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

-- Load condition aliases
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

-- GeoNames US postal code centroids (tab-delimited, no header)
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

-- Sanity checks:
-- SELECT count(*) FROM ref.us_zip_centroids;
-- SELECT * FROM ref.us_zip_centroids WHERE zip = '02139' LIMIT 5;

-- Optional: quick integrity views (non-fatal; useful for debugging)
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

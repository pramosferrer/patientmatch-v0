-- 01_bronze.sql
-- Creates Bronze views that read directly from the raw AACT text files in /rawdata/current.
-- No importing; no materialization; just stable names.

-- Use project-relative paths so scripts work regardless of absolute location.
CREATE OR REPLACE MACRO raw_dir() AS 'rawdata/current';
CREATE OR REPLACE MACRO ref_dir() AS 'ref';

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

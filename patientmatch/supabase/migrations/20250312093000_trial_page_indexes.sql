-- Ensure pg_trgm is available for trigram-based indexes used by ILIKE searches.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create a generated primary_condition column if it doesn't already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trials'
      AND column_name = 'primary_condition'
  ) THEN
    EXECUTE $$
      ALTER TABLE public.trials
      ADD COLUMN primary_condition text
      GENERATED ALWAYS AS (
        CASE
          WHEN condition_slugs IS NULL OR array_length(condition_slugs, 1) = 0 THEN NULL
          ELSE lower(condition_slugs[1])
        END
      ) STORED
    $$;
  END IF;
END
$$;

-- Helper to create indexes idempotently.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_attribute a
      ON a.attrelid = i.indrelid
     AND a.attnum = ANY (i.indkey)
    WHERE i.indrelid = 'public.trials'::regclass
      AND a.attname = 'nct_id'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX idx_trials_nct_id_unique ON public.trials (nct_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'trials'
      AND indexname = 'idx_trials_primary_condition'
  ) THEN
    EXECUTE 'CREATE INDEX idx_trials_primary_condition ON public.trials (primary_condition)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'trials'
      AND indexname = 'idx_trials_condition_slugs'
  ) THEN
    EXECUTE 'CREATE INDEX idx_trials_condition_slugs ON public.trials USING gin (condition_slugs)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'trials'
      AND indexname = 'idx_trials_location_countries'
  ) THEN
    EXECUTE 'CREATE INDEX idx_trials_location_countries ON public.trials USING gin (location_countries)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'trials'
      AND indexname = 'idx_trials_visit_model'
  ) THEN
    EXECUTE 'CREATE INDEX idx_trials_visit_model ON public.trials (visit_model)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'trials'
      AND indexname = 'idx_trials_phase'
  ) THEN
    EXECUTE 'CREATE INDEX idx_trials_phase ON public.trials (phase)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'trials'
      AND indexname = 'idx_trials_last_update_date'
  ) THEN
    EXECUTE 'CREATE INDEX idx_trials_last_update_date ON public.trials (last_update_date DESC)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'trials'
      AND indexname = 'idx_trials_recruiting_publishable'
  ) THEN
    EXECUTE $ix$
      CREATE INDEX idx_trials_recruiting_publishable
        ON public.trials (last_update_date DESC)
        WHERE is_publishable = true AND lower(status) = 'recruiting'
    $ix$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'trials'
      AND indexname = 'idx_trials_title_trgm'
  ) THEN
    EXECUTE $$
      CREATE INDEX idx_trials_title_trgm
        ON public.trials USING gin (title gin_trgm_ops)
    $$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'trials'
      AND indexname = 'idx_trials_sponsor_trgm'
  ) THEN
    EXECUTE $$
      CREATE INDEX idx_trials_sponsor_trgm
        ON public.trials USING gin (sponsor gin_trgm_ops)
    $$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'trials'
      AND indexname = 'idx_trials_locations_trgm'
  ) THEN
    EXECUTE $$
      CREATE INDEX idx_trials_locations_trgm
        ON public.trials USING gin ((locations::text) gin_trgm_ops)
    $$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trials'
      AND column_name = 'nearest_site_city'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'trials'
      AND indexname = 'idx_trials_nearest_site_city'
  ) THEN
    EXECUTE 'CREATE INDEX idx_trials_nearest_site_city ON public.trials (nearest_site_city)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trials'
      AND column_name = 'nearest_site_state'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'trials'
      AND indexname = 'idx_trials_nearest_site_state'
  ) THEN
    EXECUTE 'CREATE INDEX idx_trials_nearest_site_state ON public.trials (nearest_site_state)';
  END IF;
END
$$;

-- Conditionally add a generated geography column and GIST index if PostGIS and nearest_site JSON are available.
DO $$
DECLARE
  has_postgis boolean;
  col_data_type text;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') INTO has_postgis;

  IF has_postgis THEN
    SELECT data_type INTO col_data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trials'
      AND column_name = 'nearest_site';

    IF col_data_type = 'jsonb' THEN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'trials'
          AND column_name = 'nearest_site_geog'
      ) THEN
        EXECUTE $$
          ALTER TABLE public.trials
          ADD COLUMN nearest_site_geog geography(Point, 4326)
          GENERATED ALWAYS AS (
            CASE
              WHEN nearest_site ? 'lat' AND nearest_site ? 'lon'
                   AND (nearest_site->>'lat') IS NOT NULL AND (nearest_site->>'lon') IS NOT NULL
              THEN
                ST_SetSRID(
                  ST_MakePoint(
                    (nearest_site->>'lon')::double precision,
                    (nearest_site->>'lat')::double precision
                  ),
                  4326
                )::geography
              ELSE NULL
            END
          ) STORED
        $$;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'trials'
          AND indexname = 'idx_trials_nearest_site_geog'
      ) THEN
        EXECUTE 'CREATE INDEX idx_trials_nearest_site_geog ON public.trials USING gist (nearest_site_geog)';
      END IF;
    END IF;
  END IF;
END
$$;

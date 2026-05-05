-- Add enrichment JSON fields to trial_insights for mapping-based display.
ALTER TABLE public.trial_insights
  ADD COLUMN IF NOT EXISTS condition_body_systems_json JSONB,
  ADD COLUMN IF NOT EXISTS drug_classes_json JSONB,
  ADD COLUMN IF NOT EXISTS drug_routes_json JSONB,
  ADD COLUMN IF NOT EXISTS endpoint_categories_json JSONB,
  ADD COLUMN IF NOT EXISTS procedure_categories_json JSONB,
  ADD COLUMN IF NOT EXISTS device_categories_json JSONB,
  ADD COLUMN IF NOT EXISTS mapping_coverage_json JSONB;

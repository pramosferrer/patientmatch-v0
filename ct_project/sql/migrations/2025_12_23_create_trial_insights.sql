-- Migration: create trial_insights table
create table if not exists public.trial_insights (
  nct_id text primary key,
  pipeline_version text not null,
  input_hash text not null,
  strictness_score int,
  burden_score int,
  novelty_score int,
  logistics_score int,
  top_disqualifiers_json jsonb,
  insights_flags_json jsonb,
  plain_summary_json jsonb,
  generated_at timestamptz default now()
);

create index if not exists idx_trial_insights_pipeline_version on public.trial_insights (pipeline_version);
create index if not exists idx_trial_insights_pipeline_version_strictness on public.trial_insights (pipeline_version, strictness_score desc);

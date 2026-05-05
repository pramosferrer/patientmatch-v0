create table if not exists public.pipeline_releases (
  build_tag text primary key,
  aact_date date,
  parser_version text,
  questionnaire_version text,
  insight_version text,
  summary_version text,
  expected_trials integer,
  pushed_trials integer,
  pushed_insights integer,
  status text not null default 'building'
    check (status in ('building', 'validated', 'active', 'failed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  validated_at timestamptz,
  activated_at timestamptz
);

create index if not exists pipeline_releases_status_activated_idx
  on public.pipeline_releases (status, activated_at desc);

insert into public.pipeline_releases (
  build_tag,
  questionnaire_version,
  insight_version,
  expected_trials,
  pushed_trials,
  pushed_insights,
  status,
  notes,
  validated_at,
  activated_at
)
values (
  'pmq_v19_answerability_trim_2025_12_24',
  'pmq_v19_answerability_trim_2025_12_24',
  'pmq_v19_answerability_trim_2025_12_24',
  21928,
  21928,
  21928,
  'active',
  'Emergency recovery active release after partial February build exposed only ~2k trials.',
  now(),
  now()
)
on conflict (build_tag) do update
set
  expected_trials = excluded.expected_trials,
  pushed_trials = excluded.pushed_trials,
  pushed_insights = excluded.pushed_insights,
  status = excluded.status,
  notes = excluded.notes,
  validated_at = excluded.validated_at,
  activated_at = excluded.activated_at,
  updated_at = now();

create or replace view public.trials_serving_latest as
with active_release as (
  select build_tag
  from public.pipeline_releases
  where status = 'active'
  order by activated_at desc nulls last, updated_at desc
  limit 1
)
select
  t.*,
  i.burden_score,
  i.plain_summary_json->>'intervention_mode_primary' as intervention_mode_primary,
  i.plain_summary_json->'structured'->'dates'->>'study_duration_days' as study_duration_days
from public.trials t
join active_release r
  on r.build_tag = t.build_tag
left join public.trial_insights i
  on t.nct_id = i.nct_id
 and i.pipeline_version = t.build_tag;

create or replace view public.trial_insights_latest as
with active_release as (
  select build_tag
  from public.pipeline_releases
  where status = 'active'
  order by activated_at desc nulls last, updated_at desc
  limit 1
)
select i.*
from public.trial_insights i
join active_release r
  on r.build_tag = i.pipeline_version;

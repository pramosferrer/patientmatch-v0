create table if not exists public.trial_readiness_scores (
  nct_id text primary key,
  build_tag text not null,
  patient_readiness_score numeric not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists trial_readiness_scores_build_score_idx
  on public.trial_readiness_scores (build_tag, patient_readiness_score desc, nct_id);

alter table public.trial_readiness_scores enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'trial_readiness_scores'
      and policyname = 'Allow anon read on trial_readiness_scores'
  ) then
    create policy "Allow anon read on trial_readiness_scores"
      on public.trial_readiness_scores
      for select
      to anon
      using (true);
  end if;
end
$$;

insert into public.trial_readiness_scores (
  nct_id,
  build_tag,
  patient_readiness_score,
  updated_at
)
with active_release as (
  select build_tag
  from public.pipeline_releases
  where status = 'active'
  order by activated_at desc nulls last, updated_at desc
  limit 1
)
select
  t.nct_id,
  t.build_tag,
  (
    case when i.nct_id is not null then 20 else 0 end
    + case
        when length(nullif(trim(i.plain_summary_json->>'summary'), '')) >= 120 then 20
        when length(nullif(trim(i.plain_summary_json->>'summary'), '')) >= 40 then 10
        else 0
      end
    + case
        when lower(coalesce(i.plain_summary_json->>'confidence', i.plain_summary_json->>'summary_confidence', '')) = 'high' then 10
        when lower(coalesce(i.plain_summary_json->>'confidence', i.plain_summary_json->>'summary_confidence', '')) = 'medium' then 5
        when (i.plain_summary_json->>'confidence_score') ~ '^[0-9]+(\.[0-9]+)?$'
          and (i.plain_summary_json->>'confidence_score')::numeric >= 0.8 then 10
        when (i.plain_summary_json->>'confidence_score') ~ '^[0-9]+(\.[0-9]+)?$'
          and (i.plain_summary_json->>'confidence_score')::numeric >= 0.5 then 5
        else 0
      end
    + case when t.questionnaire_json is not null then 15 else 0 end
    + case
        when lower(coalesce(t.questionnaire_json->>'screener_confidence', '')) = 'high' then 10
        when lower(coalesce(t.questionnaire_json->>'screener_confidence', '')) = 'medium' then 5
        else 0
      end
    + case
        when coalesce(
          case when (t.questionnaire_json->>'question_count_total') ~ '^[0-9]+$'
            then (t.questionnaire_json->>'question_count_total')::integer end,
          case when (t.questionnaire_json->>'question_count') ~ '^[0-9]+$'
            then (t.questionnaire_json->>'question_count')::integer end
        ) >= 8 then 10
        when coalesce(
          case when (t.questionnaire_json->>'question_count_total') ~ '^[0-9]+$'
            then (t.questionnaire_json->>'question_count_total')::integer end,
          case when (t.questionnaire_json->>'question_count') ~ '^[0-9]+$'
            then (t.questionnaire_json->>'question_count')::integer end
        ) >= 3 then 5
        else 0
      end
    + case
        when t.quality_score is null then 0
        when t.quality_score::text !~ '^[0-9]+(\.[0-9]+)?$' then 0
        when t.quality_score::numeric > 1 then least(20, greatest(0, t.quality_score::numeric / 5.0))
        else least(20, greatest(0, t.quality_score::numeric * 20.0))
      end
    + case when i.patient_insights_json is not null then 5 else 0 end
    + case when i.plain_summary_json->>'intervention_mode_primary' is not null then 3 else 0 end
    + case when i.plain_summary_json->'structured'->'dates'->>'study_duration_days' is not null then 2 else 0 end
    + case when coalesce(t.site_count_us, 0) > 0 then 5 else 0 end
  )::numeric as patient_readiness_score,
  now()
from public.trials t
join active_release r
  on r.build_tag = t.build_tag
left join public.trial_insights i
  on t.nct_id = i.nct_id
 and i.pipeline_version = t.build_tag
on conflict (nct_id) do update
set
  build_tag = excluded.build_tag,
  patient_readiness_score = excluded.patient_readiness_score,
  updated_at = excluded.updated_at;

create or replace view public.trials_serving_latest
with (security_invoker = true) as
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
  i.plain_summary_json->'structured'->'dates'->>'study_duration_days' as study_duration_days,
  coalesce(s.patient_readiness_score, 0)::numeric as patient_readiness_score
from public.trials t
join active_release r
  on r.build_tag = t.build_tag
left join public.trial_insights i
  on t.nct_id = i.nct_id
 and i.pipeline_version = t.build_tag
left join public.trial_readiness_scores s
  on s.nct_id = t.nct_id
 and s.build_tag = t.build_tag;

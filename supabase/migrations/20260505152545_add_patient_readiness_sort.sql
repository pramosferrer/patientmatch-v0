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
  )::numeric as patient_readiness_score
from public.trials t
join active_release r
  on r.build_tag = t.build_tag
left join public.trial_insights i
  on t.nct_id = i.nct_id
 and i.pipeline_version = t.build_tag;

create or replace view public.trial_insights_latest
with (security_invoker = true) as
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

-- Extend trials_serving_latest with lightweight insight fields for card display.
-- Uses the latest build_tag based on date embedded in the tag string.

create or replace view public.trials_serving_latest as
with tag_candidates as (
  select build_tag,
         regexp_match(build_tag, '(\d{4})_(\d{2})_(\d{2})') as m
  from public.trials
  where build_tag is not null
  group by build_tag
),
ranked as (
  select
    build_tag,
    case
      when m is null then null
      else make_date((m[1])::int, (m[2])::int, (m[3])::int)
    end as tag_date
  from tag_candidates
),
latest as (
  select build_tag
  from ranked
  order by tag_date desc nulls last, build_tag desc
  limit 1
)
select
  t.*,
  i.burden_score,
  i.plain_summary_json->>'intervention_mode_primary' as intervention_mode_primary,
  i.plain_summary_json->'structured'->'dates'->>'study_duration_days' as study_duration_days
from public.trials t
left join public.trial_insights i
  on t.nct_id = i.nct_id
  and i.pipeline_version = t.build_tag
where t.build_tag = (select build_tag from latest);

create or replace view public.trial_insights_latest as
with tag_candidates as (
  select pipeline_version,
         regexp_match(pipeline_version, '(\d{4})_(\d{2})_(\d{2})') as m
  from public.trial_insights
  where pipeline_version is not null
  group by pipeline_version
),
ranked as (
  select
    pipeline_version,
    case
      when m is null then null
      else make_date((m[1])::int, (m[2])::int, (m[3])::int)
    end as tag_date
  from tag_candidates
)
select i.*
from public.trial_insights i
where i.pipeline_version = (
  select pipeline_version
  from ranked
  order by tag_date desc nulls last, pipeline_version desc
  limit 1
);

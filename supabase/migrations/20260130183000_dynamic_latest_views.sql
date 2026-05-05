-- Auto-select latest build_tag/pipeline_version based on date embedded in tag strings.
-- This avoids manual updates to the serving views on each push.

create or replace view public.trials_serving_latest as
with tag_candidates as (
  select build_tag,
         regexp_match(build_tag, '(\\d{4})_(\\d{2})_(\\d{2})') as m
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
)
select t.*
from public.trials t
where t.build_tag = (
  select build_tag
  from ranked
  order by tag_date desc nulls last, build_tag desc
  limit 1
);

create or replace view public.trial_insights_latest as
with tag_candidates as (
  select pipeline_version,
         regexp_match(pipeline_version, '(\\d{4})_(\\d{2})_(\\d{2})') as m
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

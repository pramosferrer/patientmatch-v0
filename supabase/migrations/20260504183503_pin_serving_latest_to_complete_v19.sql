-- Emergency recovery pin.
--
-- The dynamic "latest date in build_tag" view selected the partial
-- pmq_2026_02_07_condition_dictionary push, which exposed only ~2k trials.
-- Pin production serving views to the last verified complete build until the
-- release-manifest activation workflow replaces date-based latest selection.

create or replace view public.trials_serving_latest as
select
  t.*,
  i.burden_score,
  i.plain_summary_json->>'intervention_mode_primary' as intervention_mode_primary,
  i.plain_summary_json->'structured'->'dates'->>'study_duration_days' as study_duration_days
from public.trials t
left join public.trial_insights i
  on t.nct_id = i.nct_id
 and i.pipeline_version = t.build_tag
where t.build_tag = 'pmq_v19_answerability_trim_2025_12_24';

create or replace view public.trial_insights_latest as
select i.*
from public.trial_insights i
where i.pipeline_version = 'pmq_v19_answerability_trim_2025_12_24';

create or replace view public.trials_serving_latest as
select *
from public.trials
where build_tag = 'pmq_2026_01_29_latest';

create or replace view public.trial_insights_latest as
select *
from public.trial_insights
where pipeline_version = 'pmq_2026_01_29_latest';

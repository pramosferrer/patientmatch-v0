create or replace function public.nearest_active_trials_page(
  in_lat double precision,
  in_lon double precision,
  max_miles double precision default null,
  page_limit integer default 24,
  page_offset integer default 0,
  condition_values text[] default null,
  status_values text[] default null
)
returns table (
  nct_id text,
  city text,
  state_code text,
  facility_name text,
  lat double precision,
  lon double precision,
  nearest_miles double precision,
  total_count bigint
)
language sql
stable
set search_path = public, extensions
as $$
with active_release as (
  select build_tag
  from public.pipeline_releases
  where status = 'active'
  order by activated_at desc nulls last, updated_at desc
  limit 1
),
origin as (
  select st_setsrid(st_makepoint(in_lon, in_lat), 4326)::geography as geog
),
nearest_sites as (
  select
    s.nct_id,
    s.city,
    s.state_code,
    s.facility_name,
    s.lat,
    s.lon,
    st_distance(s.geom, origin.geog) / 1609.34 as nearest_miles
  from public.trial_sites s
  join active_release r
    on r.build_tag = s.build_tag
  cross join origin
  where s.geom is not null
    and (max_miles is null or st_dwithin(s.geom, origin.geog, max_miles * 1609.34))
  order by s.geom <-> origin.geog
  limit least(5000, greatest(500, (greatest(0, page_offset) + greatest(1, least(page_limit, 100))) * 25))
),
filtered_sites as (
  select nearest_sites.*
  from nearest_sites
  where (
    (condition_values is null or cardinality(condition_values) = 0)
    and (status_values is null or cardinality(status_values) = 0)
  )
  or exists (
    select 1
    from public.trials t
    join active_release r
      on r.build_tag = t.build_tag
    where t.nct_id = nearest_sites.nct_id
      and (condition_values is null or cardinality(condition_values) = 0 or t.conditions && condition_values)
      and (status_values is null or cardinality(status_values) = 0 or t.status_bucket = any(status_values))
  )
),
nearest_per_trial as (
  select distinct on (nct_id)
    nct_id,
    city,
    state_code,
    facility_name,
    lat,
    lon,
    nearest_miles
  from filtered_sites
  order by nct_id, nearest_miles asc
),
counted as (
  select
    nearest_per_trial.*,
    count(*) over () as total_count
  from nearest_per_trial
)
select
  nct_id,
  city,
  state_code,
  facility_name,
  lat,
  lon,
  nearest_miles,
  total_count
from counted
order by nearest_miles asc, nct_id asc
limit greatest(1, least(page_limit, 100))
offset greatest(0, page_offset);
$$;

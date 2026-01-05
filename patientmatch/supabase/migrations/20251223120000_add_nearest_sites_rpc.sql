-- Create the nearest_sites_with_meta function
CREATE OR REPLACE FUNCTION "public"."nearest_sites_with_meta"("in_lat" double precision, "in_lon" double precision, "max_miles" double precision DEFAULT NULL::double precision) 
RETURNS TABLE("trial_id" "uuid", "nct_id" "text", "city" "text", "state" "text", "lat" double precision, "lon" double precision, "nearest_miles" double precision)
    LANGUAGE "sql" STABLE
    AS $$
with u as (
  select ST_SetSRID(ST_MakePoint(in_lon, in_lat), 4326)::geography as g
),
candidates as (
  select
    s.trial_id, s.nct_id, s.city, s.state, s.lat, s.lon,
    ST_Distance(s.geom, u.g) as meters
  from public.sites s, u
  where s.geom is not null
    and (max_miles is null or ST_DWithin(s.geom, u.g, max_miles * 1609.34))
),
ranked as (
  select *,
         row_number() over (partition by trial_id order by meters asc) as rn
  from candidates
)
select
  trial_id, nct_id, city, state, lat, lon,
  (meters / 1609.34) as nearest_miles
from ranked
where rn = 1;
$$;

ALTER FUNCTION "public"."nearest_sites_with_meta"("in_lat" double precision, "in_lon" double precision, "max_miles" double precision) OWNER TO "postgres";

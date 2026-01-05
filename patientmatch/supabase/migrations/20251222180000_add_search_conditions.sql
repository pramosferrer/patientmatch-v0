-- Create a function to search conditions by label
create or replace function public.search_conditions(query text)
returns table (
  slug text,
  label text
) 
language sql
stable
as $$
  select
    slug,
    label
  from
    public.conditions
  where
    label ilike '%' || query || '%'
  order by
    case when label ilike query then 0 else 1 end,
    case when label ilike query || '%' then 0 else 1 end,
    label
  limit 10;
$$;

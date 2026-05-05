-- Follow-up for Supabase advisors on PostGIS objects in the exposed public schema.

do $$
begin
  if to_regclass('public.spatial_ref_sys') is not null then
    revoke all on table public.spatial_ref_sys from public, anon, authenticated;
  end if;
end
$$;

do $$
begin
  if to_regprocedure('public.st_estimatedextent(text,text)') is not null then
    revoke execute on function public.st_estimatedextent(text,text) from public, anon, authenticated;
  end if;
  if to_regprocedure('public.st_estimatedextent(text,text,text)') is not null then
    revoke execute on function public.st_estimatedextent(text,text,text) from public, anon, authenticated;
  end if;
  if to_regprocedure('public.st_estimatedextent(text,text,text,boolean)') is not null then
    revoke execute on function public.st_estimatedextent(text,text,text,boolean) from public, anon, authenticated;
  end if;
end
$$;

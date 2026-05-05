-- Launch hardening for public Data API exposure.
-- Keep patient-facing trial data readable while blocking write-only tables
-- and making serving views respect underlying table permissions.

alter view if exists public.trials_serving_latest set (security_invoker = true);
alter view if exists public.trial_insights_latest set (security_invoker = true);

do $$
begin
  if to_regclass('public.trials') is not null then
    execute 'alter table public.trials enable row level security';
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'trials'
        and policyname = 'Allow anon read on trials'
    ) then
      execute 'create policy "Allow anon read on trials" on public.trials for select to anon using (true)';
    end if;
  end if;

  if to_regclass('public.trial_insights') is not null then
    execute 'alter table public.trial_insights enable row level security';
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'trial_insights'
        and policyname = 'Allow anon read on trial_insights'
    ) then
      execute 'create policy "Allow anon read on trial_insights" on public.trial_insights for select to anon using (true)';
    end if;
  end if;

  if to_regclass('public.pipeline_releases') is not null then
    execute 'alter table public.pipeline_releases enable row level security';
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'pipeline_releases'
        and policyname = 'Allow anon read on pipeline_releases'
    ) then
      execute 'create policy "Allow anon read on pipeline_releases" on public.pipeline_releases for select to anon using (true)';
    end if;
  end if;

  if to_regclass('public.events') is not null then
    execute 'alter table public.events enable row level security';
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'events'
        and policyname = 'Deny anon and authenticated on events'
    ) then
      execute 'create policy "Deny anon and authenticated on events" on public.events for all to anon, authenticated using (false)';
    end if;
  end if;

  if to_regclass('public.analytics_events') is not null then
    execute 'alter table public.analytics_events enable row level security';
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'analytics_events'
        and policyname = 'Deny anon and authenticated on analytics_events'
    ) then
      execute 'create policy "Deny anon and authenticated on analytics_events" on public.analytics_events for all to anon, authenticated using (false)';
    end if;
  end if;

  if to_regclass('public.patient_result_feedback') is not null then
    execute 'alter table public.patient_result_feedback enable row level security';
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'patient_result_feedback'
        and policyname = 'Deny anon and authenticated on patient_result_feedback'
    ) then
      execute 'create policy "Deny anon and authenticated on patient_result_feedback" on public.patient_result_feedback for all to anon, authenticated using (false)';
    end if;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.spatial_ref_sys') is not null then
    revoke all on table public.spatial_ref_sys from anon, authenticated;
  end if;
end
$$;

do $$
begin
  if to_regprocedure('public.st_estimatedextent(text,text)') is not null then
    revoke execute on function public.st_estimatedextent(text,text) from anon, authenticated;
  end if;
  if to_regprocedure('public.st_estimatedextent(text,text,text)') is not null then
    revoke execute on function public.st_estimatedextent(text,text,text) from anon, authenticated;
  end if;
  if to_regprocedure('public.st_estimatedextent(text,text,text,boolean)') is not null then
    revoke execute on function public.st_estimatedextent(text,text,text,boolean) from anon, authenticated;
  end if;
end
$$;

do $$
begin
  if to_regprocedure('public.nearest_sites_with_meta(double precision,double precision,double precision)') is not null then
    alter function public.nearest_sites_with_meta(double precision,double precision,double precision)
      set search_path = public, extensions;
  end if;
end
$$;

create table if not exists public.match_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_json jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.match_sessions enable row level security;

-- Deny all access by default (service role can still bypass)
drop policy if exists ms_deny_all on public.match_sessions;
create policy ms_deny_all on public.match_sessions for all using (false);

-- Index for cleanup/analytics
create index if not exists idx_match_sessions_created_at on public.match_sessions(created_at);

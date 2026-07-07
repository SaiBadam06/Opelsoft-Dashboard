-- 7-day cache for live GitHub API lookups during resume parsing.
-- Idempotent: the table may already exist from earlier work on another branch.
create table if not exists public.github_cache (
  key text primary key,
  data jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table public.github_cache enable row level security;

-- Cache is non-sensitive; any authenticated user may read/write it.
-- (Postgres has no "create policy if not exists" — drop-then-create for idempotency.)
drop policy if exists "github_cache_read" on public.github_cache;
create policy "github_cache_read" on public.github_cache for select to authenticated using (true);

drop policy if exists "github_cache_write" on public.github_cache;
create policy "github_cache_write" on public.github_cache for insert to authenticated with check (true);

drop policy if exists "github_cache_update" on public.github_cache;
create policy "github_cache_update" on public.github_cache for update to authenticated using (true) with check (true);

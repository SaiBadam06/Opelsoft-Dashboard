-- Full AI parse of a candidate's resume, kept for autofill provenance and skill search.
create table if not exists public.candidate_parsings (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  skills text[] not null default '{}',    -- normalized (trimmed, lowercased); drives global skill search
  parsed jsonb not null,                   -- full ParsedResume
  github_repos jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index if not exists candidate_parsings_candidate_idx on public.candidate_parsings(candidate_id);
-- GIN on skills[] deliberately omitted (ponytail): overlap runs in JS until volume demands it.

alter table public.candidate_parsings enable row level security;

-- Visibility mirrors candidates: admins see all, coordinators see their own.
-- (Postgres has no "create policy if not exists" — drop-then-create for idempotency.)
drop policy if exists "candidate_parsings_select" on public.candidate_parsings;
create policy "candidate_parsings_select" on public.candidate_parsings for select
  using (
    exists (
      select 1 from public.candidates c
      where c.id = candidate_id
        and (public.is_admin() or c.assigned_coordinator_id = auth.uid())
    )
  );

drop policy if exists "candidate_parsings_insert" on public.candidate_parsings;
create policy "candidate_parsings_insert" on public.candidate_parsings for insert
  with check (
    exists (
      select 1 from public.candidates c
      where c.id = candidate_id
        and (public.is_admin() or c.assigned_coordinator_id = auth.uid())
    )
  );

drop policy if exists "candidate_parsings_delete" on public.candidate_parsings;
create policy "candidate_parsings_delete" on public.candidate_parsings for delete
  using (
    exists (
      select 1 from public.candidates c
      where c.id = candidate_id
        and (public.is_admin() or c.assigned_coordinator_id = auth.uid())
    )
  );

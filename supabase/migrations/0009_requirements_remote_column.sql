-- Live Supabase had work_mode (text) but not remote (boolean) from 0003.
-- App queries requirements.remote for list/detail, forms, and job posting defaults.

alter table public.requirements
  add column if not exists remote boolean not null default false;

-- Backfill from work_mode where present (e.g. "Remote", "Hybrid")
update public.requirements
set remote = true
where not remote
  and work_mode is not null
  and work_mode ilike '%remote%';

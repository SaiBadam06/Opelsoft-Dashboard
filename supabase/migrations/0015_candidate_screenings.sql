-- ATS screening: a candidate's AI match score against a requirement. One row per
-- (requirement, candidate); re-scoring upserts.
create table if not exists public.candidate_screenings (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.requirements(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  score int not null,
  eligibility text not null,
  reason text not null,
  score_breakdown jsonb not null default '[]',
  requirement_matches jsonb not null default '[]',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (requirement_id, candidate_id)
);

create index if not exists candidate_screenings_requirement_idx
  on public.candidate_screenings (requirement_id);

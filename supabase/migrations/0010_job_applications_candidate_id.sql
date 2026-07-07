-- Link careers applications to candidates after conversion (recruiter workflow).

alter table public.job_applications
  add column if not exists candidate_id uuid references public.candidates(id) on delete set null;

create index if not exists job_applications_candidate_idx
  on public.job_applications(candidate_id);

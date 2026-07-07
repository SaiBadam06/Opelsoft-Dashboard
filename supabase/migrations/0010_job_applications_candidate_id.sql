-- Link careers applications to candidates after conversion (recruiter workflow).

alter table public.job_applications
  add column if not exists candidate_id uuid references public.candidates(id) on delete set null;

create index if not exists job_applications_candidate_idx
  on public.job_applications(candidate_id);

-- Backfill converted applications where candidate exists with same email
update public.job_applications ja
set candidate_id = c.id
from public.candidates c
where ja.candidate_id is null
  and ja.status = 'converted'
  and lower(trim(ja.email)) = lower(trim(c.email));

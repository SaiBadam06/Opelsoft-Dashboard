-- Enums
create type public.candidate_status as enum (
  'available','interviewing','submitted','offered','placed','rejected','inactive'
);
create type public.pipeline_stage as enum (
  'new','contacted','interested','resume_received','screening','matched',
  'submitted','interview_r1','interview_r2','final_interview',
  'offer_released','offer_accepted','placed','rejected','hold'
);

-- Generic updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  location text,
  experience_years numeric,
  current_company text,
  rate numeric,                       -- hourly $
  visa text,                          -- work authorization
  relocation text,
  petitioner text,
  availability text,
  linkedin text,
  github text,
  portfolio text,
  primary_skills text,
  secondary_skills text,
  certifications text,
  projects text,
  education text,
  preferred_location text,
  status public.candidate_status not null default 'available',
  pipeline_stage public.pipeline_stage not null default 'new',
  visa_transfer boolean not null default false,   -- H1T list
  notes text,
  assigned_coordinator_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index candidates_coordinator_idx on public.candidates(assigned_coordinator_id);
create index candidates_status_idx on public.candidates(status);
create index candidates_stage_idx on public.candidates(pipeline_stage);

create trigger candidates_set_updated_at
  before update on public.candidates
  for each row execute function public.set_updated_at();

-- RLS: coordinators see only their own; admins see all
alter table public.candidates enable row level security;

create policy "candidates_select" on public.candidates for select
  using (public.is_admin() or assigned_coordinator_id = auth.uid());

create policy "candidates_insert" on public.candidates for insert
  with check (public.is_admin() or assigned_coordinator_id = auth.uid());

create policy "candidates_update" on public.candidates for update
  using (public.is_admin() or assigned_coordinator_id = auth.uid());

create policy "candidates_delete" on public.candidates for delete
  using (public.is_admin() or assigned_coordinator_id = auth.uid());
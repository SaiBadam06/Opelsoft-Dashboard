-- Enums
create type public.interview_result as enum (
  'scheduled','pending','passed','failed','cancelled'
);
create type public.placement_status as enum ('active','completed','terminated');
create type public.task_type as enum (
  'call','follow_up','schedule_interview','collect_documents',
  'send_resume','offer_discussion','other'
);
create type public.task_status as enum ('pending','done');

-- Interviews
create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.candidates(id) on delete cascade,
  requirement_id uuid references public.requirements(id) on delete set null,
  end_client text,
  round text,
  interview_date timestamptz,
  mode text,                          -- phone / video / onsite
  interviewer text,
  feedback text,
  result public.interview_result not null default 'scheduled',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index interviews_candidate_idx on public.interviews(candidate_id);
create index interviews_date_idx on public.interviews(interview_date);
create trigger interviews_set_updated_at before update on public.interviews
  for each row execute function public.set_updated_at();

-- Placements
create table public.placements (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.candidates(id) on delete cascade,
  recruiter text,
  opt_recruiter text,
  vendor_id uuid references public.vendors(id) on delete set null,
  end_client text,
  new_exp text,                       -- New / Exp
  rate numeric,
  placement_date date,
  project_start_date date,
  bgv_date date,
  in_out text,                        -- In / Out
  project_end_date date,
  feedback text,
  status public.placement_status not null default 'active',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index placements_candidate_idx on public.placements(candidate_id);
create trigger placements_set_updated_at before update on public.placements
  for each row execute function public.set_updated_at();

-- Tasks / reminders
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type public.task_type not null default 'follow_up',
  candidate_id uuid references public.candidates(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  due_date date,
  status public.task_status not null default 'pending',
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_assigned_idx on public.tasks(assigned_to);
create index tasks_status_idx on public.tasks(status);
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- RLS: shared workspace data — authenticated read/write; admin delete
alter table public.interviews enable row level security;
alter table public.placements enable row level security;
alter table public.tasks enable row level security;

create policy "interviews_read" on public.interviews for select to authenticated using (true);
create policy "interviews_write" on public.interviews for insert to authenticated with check (true);
create policy "interviews_update" on public.interviews for update to authenticated using (true);
create policy "interviews_delete" on public.interviews for delete to authenticated using (public.is_admin());

create policy "placements_read" on public.placements for select to authenticated using (true);
create policy "placements_write" on public.placements for insert to authenticated with check (true);
create policy "placements_update" on public.placements for update to authenticated using (true);
create policy "placements_delete" on public.placements for delete to authenticated using (public.is_admin());

create policy "tasks_read" on public.tasks for select to authenticated using (true);
create policy "tasks_write" on public.tasks for insert to authenticated with check (true);
create policy "tasks_update" on public.tasks for update to authenticated using (true);
create policy "tasks_delete" on public.tasks for delete to authenticated using (public.is_admin());

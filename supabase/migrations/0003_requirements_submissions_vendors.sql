-- Enums
create type public.requirement_priority as enum ('low','medium','high','urgent');
create type public.requirement_status as enum ('open','on_hold','filled','closed');
create type public.submission_status as enum (
  'submitted','viewed','interview_scheduled','rejected','offer'
);
create type public.prime_layer as enum ('prime','layer');

-- Vendors (job providers)
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger vendors_set_updated_at before update on public.vendors
  for each row execute function public.set_updated_at();

-- Requirements (open roles from vendors)
create table public.requirements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  vendor_id uuid references public.vendors(id) on delete set null,
  end_client text,
  experience text,
  skills text,
  location text,
  remote boolean not null default false,
  rate numeric,
  employment_type text,
  priority public.requirement_priority not null default 'medium',
  status public.requirement_status not null default 'open',
  closing_date date,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index requirements_vendor_idx on public.requirements(vendor_id);
create index requirements_status_idx on public.requirements(status);
create trigger requirements_set_updated_at before update on public.requirements
  for each row execute function public.set_updated_at();

-- Submissions (candidate -> requirement)
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.candidates(id) on delete cascade,
  requirement_id uuid references public.requirements(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  end_client text,
  prime_layer public.prime_layer,
  rate numeric,
  submitted_date date not null default current_date,
  resume_version text,
  status public.submission_status not null default 'submitted',
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index submissions_candidate_idx on public.submissions(candidate_id);
create index submissions_requirement_idx on public.submissions(requirement_id);
create trigger submissions_set_updated_at before update on public.submissions
  for each row execute function public.set_updated_at();

-- RLS: shared workspace data — any authenticated user reads/writes; admin deletes
alter table public.vendors enable row level security;
alter table public.requirements enable row level security;
alter table public.submissions enable row level security;

create policy "vendors_read" on public.vendors for select to authenticated using (true);
create policy "vendors_write" on public.vendors for insert to authenticated with check (true);
create policy "vendors_update" on public.vendors for update to authenticated using (true);
create policy "vendors_delete" on public.vendors for delete to authenticated using (public.is_admin());

create policy "requirements_read" on public.requirements for select to authenticated using (true);
create policy "requirements_write" on public.requirements for insert to authenticated with check (true);
create policy "requirements_update" on public.requirements for update to authenticated using (true);
create policy "requirements_delete" on public.requirements for delete to authenticated using (public.is_admin());

create policy "submissions_read" on public.submissions for select to authenticated using (true);
create policy "submissions_write" on public.submissions for insert to authenticated with check (true);
create policy "submissions_update" on public.submissions for update to authenticated using (true);
create policy "submissions_delete" on public.submissions for delete to authenticated using (public.is_admin());

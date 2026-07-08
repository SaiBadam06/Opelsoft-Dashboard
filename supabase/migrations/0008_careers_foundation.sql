-- Careers platform foundation: career sites, job postings, distributions, applications.

-- Enums
create type public.job_posting_status as enum ('draft', 'published', 'closed');
create type public.workplace_type as enum ('remote', 'hybrid', 'onsite');
create type public.job_application_status as enum (
  'new',
  'reviewing',
  'shortlisted',
  'rejected',
  'converted'
);

-- Distribution channel registry (careers_site active; boards inactive for now)
create table public.distribution_channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.distribution_channels (slug, name, is_active) values
  ('careers_site', 'Careers site', true),
  ('linkedin', 'LinkedIn', false),
  ('indeed', 'Indeed', false),
  ('other', 'Other', false);

-- Branded career sites (domain resolves public host → site)
create table public.career_sites (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  domain text unique,
  logo_url text,
  primary_color text default '#2563eb',
  hero_headline text,
  hero_subtext text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger career_sites_set_updated_at before update on public.career_sites
  for each row execute function public.set_updated_at();

insert into public.career_sites (slug, name, domain, hero_headline, hero_subtext, primary_color) values
  (
    'opelsoft',
    'Opelsoft',
    null,
    'Careers at Opelsoft',
    'Join our team of technology consultants and engineers.',
    '#2563eb'
  ),
  (
    'futurestack',
    'Futurestack',
    null,
    'Careers at Futurestack',
    'Build the future with innovative technology talent.',
    '#7c3aed'
  ),
  (
    'talent2meet',
    'Talent2Meet',
    null,
    'Careers at Talent2Meet',
    'Connecting exceptional talent with great opportunities.',
    '#059669'
  );

-- Public job postings (sanitized; never expose requirements to anon)
create table public.job_postings (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid references public.requirements(id) on delete set null,
  public_slug text not null unique,
  title text not null,
  location text,
  workplace_type public.workplace_type not null default 'onsite',
  employment_type text,
  description text,
  skills text,
  status public.job_posting_status not null default 'draft',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index job_postings_requirement_idx on public.job_postings(requirement_id);
create index job_postings_status_idx on public.job_postings(status);
create index job_postings_slug_idx on public.job_postings(public_slug);

create trigger job_postings_set_updated_at before update on public.job_postings
  for each row execute function public.set_updated_at();

-- Where a posting is distributed (per channel + optional career site)
create table public.posting_distributions (
  id uuid primary key default gen_random_uuid(),
  job_posting_id uuid not null references public.job_postings(id) on delete cascade,
  distribution_channel_id uuid not null references public.distribution_channels(id),
  career_site_id uuid references public.career_sites(id) on delete cascade,
  external_id text,
  is_active boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (job_posting_id, distribution_channel_id, career_site_id)
);

create index posting_distributions_site_idx on public.posting_distributions(career_site_id);
create index posting_distributions_posting_idx on public.posting_distributions(job_posting_id);

-- Inbound job applications
create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_posting_id uuid not null references public.job_postings(id) on delete cascade,
  distribution_id uuid references public.posting_distributions(id) on delete set null,
  source text not null default 'careers_site',
  candidate_name text not null,
  email text not null,
  phone text,
  location text,
  linkedin_url text,
  portfolio_url text,
  resume_path text,
  cover_note text,
  status public.job_application_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index job_applications_posting_idx on public.job_applications(job_posting_id);
create index job_applications_status_idx on public.job_applications(status);

create trigger job_applications_set_updated_at before update on public.job_applications
  for each row execute function public.set_updated_at();

-- Private storage for application resumes
insert into storage.buckets (id, name, public)
values ('application-resumes', 'application-resumes', false)
on conflict (id) do nothing;

-- RLS
alter table public.distribution_channels enable row level security;
alter table public.career_sites enable row level security;
alter table public.job_postings enable row level security;
alter table public.posting_distributions enable row level security;
alter table public.job_applications enable row level security;

-- distribution_channels: authenticated read; admin write
create policy "channels_read" on public.distribution_channels
  for select to authenticated using (true);
create policy "channels_admin_write" on public.distribution_channels
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- career_sites: anon + auth read active sites; admin write
create policy "career_sites_public_read" on public.career_sites
  for select using (is_active = true);
create policy "career_sites_admin_write" on public.career_sites
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- job_postings: authenticated full access (dashboard); no anon direct access
create policy "job_postings_read" on public.job_postings
  for select to authenticated using (true);
create policy "job_postings_write" on public.job_postings
  for insert to authenticated with check (true);
create policy "job_postings_update" on public.job_postings
  for update to authenticated using (true);
create policy "job_postings_delete" on public.job_postings
  for delete to authenticated using (public.is_admin());

-- posting_distributions: authenticated full access
create policy "distributions_read" on public.posting_distributions
  for select to authenticated using (true);
create policy "distributions_write" on public.posting_distributions
  for insert to authenticated with check (true);
create policy "distributions_update" on public.posting_distributions
  for update to authenticated using (true);
create policy "distributions_delete" on public.posting_distributions
  for delete to authenticated using (public.is_admin());

-- job_applications: authenticated full access
create policy "applications_read" on public.job_applications
  for select to authenticated using (true);
create policy "applications_write" on public.job_applications
  for insert to authenticated with check (true);
create policy "applications_update" on public.job_applications
  for update to authenticated using (true);
create policy "applications_delete" on public.job_applications
  for delete to authenticated using (public.is_admin());

-- Storage policies for application resumes (authenticated dashboard access)
create policy "application-resumes read" on storage.objects
  for select to authenticated using (bucket_id = 'application-resumes');
create policy "application-resumes insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'application-resumes');
create policy "application-resumes delete" on storage.objects
  for delete to authenticated using (bucket_id = 'application-resumes');

-- Public RPCs: anon-safe read of published jobs per career site
create or replace function public.get_public_jobs(p_site_id uuid)
returns table (
  id uuid,
  public_slug text,
  title text,
  location text,
  workplace_type public.workplace_type,
  employment_type text,
  skills text,
  published_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    jp.id,
    jp.public_slug,
    jp.title,
    jp.location,
    jp.workplace_type,
    jp.employment_type,
    jp.skills,
    pd.published_at
  from public.job_postings jp
  inner join public.posting_distributions pd on pd.job_posting_id = jp.id
  inner join public.distribution_channels dc on dc.id = pd.distribution_channel_id
  where jp.status = 'published'
    and pd.is_active = true
    and pd.career_site_id = p_site_id
    and dc.slug = 'careers_site'
    and dc.is_active = true
  order by pd.published_at desc nulls last, jp.created_at desc;
$$;

create or replace function public.get_public_job(p_site_id uuid, p_slug text)
returns table (
  id uuid,
  public_slug text,
  title text,
  location text,
  workplace_type public.workplace_type,
  employment_type text,
  description text,
  skills text,
  published_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    jp.id,
    jp.public_slug,
    jp.title,
    jp.location,
    jp.workplace_type,
    jp.employment_type,
    jp.description,
    jp.skills,
    pd.published_at
  from public.job_postings jp
  inner join public.posting_distributions pd on pd.job_posting_id = jp.id
  inner join public.distribution_channels dc on dc.id = pd.distribution_channel_id
  where jp.status = 'published'
    and jp.public_slug = p_slug
    and pd.is_active = true
    and pd.career_site_id = p_site_id
    and dc.slug = 'careers_site'
    and dc.is_active = true
  limit 1;
$$;

grant execute on function public.get_public_jobs(uuid) to anon, authenticated;
grant execute on function public.get_public_job(uuid, text) to anon, authenticated;

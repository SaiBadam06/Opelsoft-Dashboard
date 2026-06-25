-- Roles
create type public.user_role as enum ('admin', 'coordinator');

-- Profiles mirror auth.users
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'coordinator',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helper: is the current user an admin? (security definer avoids RLS recursion)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

-- Auto-create a profile when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;

-- Everyone authenticated can read their own profile
create policy "read own profile"
  on public.profiles for select
  using (id = auth.uid());

-- Admins can read all profiles
create policy "admin reads all profiles"
  on public.profiles for select
  using (public.is_admin());

-- Users can update their own profile; admins can update anyone
create policy "update own profile"
  on public.profiles for update
  using (id = auth.uid());

create policy "admin updates any profile"
  on public.profiles for update
  using (public.is_admin());

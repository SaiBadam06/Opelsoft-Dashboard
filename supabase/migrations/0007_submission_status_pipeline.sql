-- 0007_submission_status_pipeline.sql
-- Submission Pipeline: full status lifecycle + status history.

-- 1) Recreate submission_status enum with the 11 pipeline values.
--    Legacy values are remapped: viewed -> client_review, offer -> selected.
alter type public.submission_status rename to submission_status_old;

create type public.submission_status as enum (
  'matched',
  'rtr_requested',
  'rtr_received',
  'submitted',
  'client_review',
  'interview_requested',
  'interview_scheduled',
  'selected',
  'rejected',
  'on_hold',
  'placed'
);

alter table public.submissions
  alter column status drop default,
  alter column status type public.submission_status
    using (
      case status::text
        when 'viewed' then 'client_review'
        when 'offer'  then 'selected'
        else status::text
      end
    )::public.submission_status,
  alter column status set default 'submitted';

drop type public.submission_status_old;

-- 2) Status history — one row per status change (incl. the initial insert).
create table public.submission_status_history (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  from_status public.submission_status,
  to_status public.submission_status not null,
  changed_by uuid references public.profiles(id),
  changed_by_name text,
  changed_at timestamptz not null default now()
);
create index submission_status_history_submission_idx
  on public.submission_status_history(submission_id, changed_at desc);

alter table public.submission_status_history enable row level security;
create policy "ssh_read" on public.submission_status_history
  for select to authenticated using (true);
-- Inserts are trigger-only (security definer); no client insert policy.

-- 3) Trigger: log every status change automatically (covers all code paths).
--    security definer so it can read the actor's name past profiles RLS.
create or replace function public.log_submission_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  select full_name into v_name from public.profiles where id = auth.uid();
  if (tg_op = 'INSERT') then
    insert into public.submission_status_history
      (submission_id, from_status, to_status, changed_by, changed_by_name)
    values (new.id, null, new.status, auth.uid(), v_name);
  elsif (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into public.submission_status_history
      (submission_id, from_status, to_status, changed_by, changed_by_name)
    values (new.id, old.status, new.status, auth.uid(), v_name);
  end if;
  return new;
end;
$$;

create trigger submissions_log_status
  after insert or update on public.submissions
  for each row execute function public.log_submission_status_change();

-- 4) Backfill a baseline history entry for submissions that already exist.
insert into public.submission_status_history
  (submission_id, from_status, to_status, changed_by, changed_by_name, changed_at)
select s.id, null, s.status, s.created_by, p.full_name, s.created_at
from public.submissions s
left join public.profiles p on p.id = s.created_by;

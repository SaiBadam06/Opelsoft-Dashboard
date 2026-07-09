-- 0011_activity_logs_and_notes.sql
-- Epic: Activity Log and Audit Trail
-- Implements manual notes and append-only activity logging.

-- 1) Notes Table
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.candidates(id) on delete cascade,
  requirement_id uuid references public.requirements(id) on delete cascade,
  submission_id uuid references public.submissions(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete cascade,
  author_id uuid references public.profiles(id),
  author_name text,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint notes_entity_check check (
    (candidate_id is not null)::int +
    (requirement_id is not null)::int +
    (submission_id is not null)::int +
    (vendor_id is not null)::int = 1
  )
);
create index notes_candidate_idx on public.notes(candidate_id) where candidate_id is not null;
create index notes_requirement_idx on public.notes(requirement_id) where requirement_id is not null;
create index notes_submission_idx on public.notes(submission_id) where submission_id is not null;
create index notes_vendor_idx on public.notes(vendor_id) where vendor_id is not null;

create trigger notes_set_updated_at before update on public.notes
  for each row execute function public.set_updated_at();

alter table public.notes enable row level security;
-- everyone can read non-deleted notes
create policy "notes_read" on public.notes for select to authenticated using (deleted_at is null);
-- everyone can insert
create policy "notes_write" on public.notes for insert to authenticated with check (true);
-- author can update content or soft delete
create policy "notes_update" on public.notes for update to authenticated using (author_id = auth.uid());
-- admin can hard delete
create policy "notes_delete" on public.notes for delete to authenticated using (public.is_admin());


-- 2) Activity Logs Table
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.candidates(id) on delete cascade,
  requirement_id uuid references public.requirements(id) on delete cascade,
  submission_id uuid references public.submissions(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete cascade,
  action text not null,
  actor_id uuid references public.profiles(id),
  actor_name text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint activity_logs_entity_check check (
    (candidate_id is not null)::int +
    (requirement_id is not null)::int +
    (submission_id is not null)::int +
    (vendor_id is not null)::int = 1
  )
);
create index activity_logs_candidate_idx on public.activity_logs(candidate_id) where candidate_id is not null;
create index activity_logs_requirement_idx on public.activity_logs(requirement_id) where requirement_id is not null;
create index activity_logs_submission_idx on public.activity_logs(submission_id) where submission_id is not null;
create index activity_logs_vendor_idx on public.activity_logs(vendor_id) where vendor_id is not null;
create index activity_logs_created_idx on public.activity_logs(created_at desc);

alter table public.activity_logs enable row level security;
create policy "activity_logs_read" on public.activity_logs for select to authenticated using (true);
create policy "activity_logs_write" on public.activity_logs for insert to authenticated with check (true);


-- 3) Automated Logging Triggers

-- Trigger: Consultant created
create or replace function public.log_candidate_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.activity_logs(candidate_id, action, actor_id, actor_name)
  values (new.id, 'Consultant created', auth.uid(), v_name);
  return new;
end;
$$;
create trigger candidates_log_insert after insert on public.candidates
for each row execute function public.log_candidate_created();


-- Trigger: Resume uploaded
create or replace function public.log_document_uploaded()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  select full_name into v_name from public.profiles where id = auth.uid();
  if (new.type = 'resume') then
    insert into public.activity_logs(candidate_id, action, actor_id, actor_name, metadata)
    values (new.candidate_id, 'Resume uploaded', auth.uid(), v_name, jsonb_build_object('file_name', new.file_name));
  end if;
  return new;
end;
$$;
create trigger documents_log_insert after insert on public.documents
for each row execute function public.log_document_uploaded();


-- Trigger: Requirement created
create or replace function public.log_requirement_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.activity_logs(requirement_id, action, actor_id, actor_name)
  values (new.id, 'Requirement created', auth.uid(), v_name);
  return new;
end;
$$;
create trigger requirements_log_insert after insert on public.requirements
for each row execute function public.log_requirement_created();


-- Trigger: Submission created
create or replace function public.log_submission_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.activity_logs(submission_id, action, actor_id, actor_name)
  values (new.id, 'Submission created', auth.uid(), v_name);
  return new;
end;
$$;
create trigger submissions_log_insert after insert on public.submissions
for each row execute function public.log_submission_created();


-- Trigger: Task completed (Follow-up completed)
create or replace function public.log_task_completed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  select full_name into v_name from public.profiles where id = auth.uid();
  if (tg_op = 'UPDATE' and old.status != 'completed' and new.status = 'completed' and new.candidate_id is not null) then
    insert into public.activity_logs(candidate_id, action, actor_id, actor_name, metadata)
    values (new.candidate_id, 'Follow-up completed', auth.uid(), v_name, jsonb_build_object('task_title', new.title));
  end if;
  return new;
end;
$$;
create trigger tasks_log_complete after update on public.tasks
for each row execute function public.log_task_completed();


-- Trigger: Note added
create or replace function public.log_note_added()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.activity_logs(
    candidate_id, requirement_id, submission_id, vendor_id, 
    action, actor_id, actor_name
  )
  values (
    new.candidate_id, new.requirement_id, new.submission_id, new.vendor_id, 
    'Note added', auth.uid(), v_name
  );
  return new;
end;
$$;
create trigger notes_log_insert after insert on public.notes
for each row execute function public.log_note_added();


-- Trigger: Submission status changed
create or replace function public.log_submission_status_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  select full_name into v_name from public.profiles where id = auth.uid();
  if (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into public.activity_logs(submission_id, action, actor_id, actor_name, metadata)
    values (new.id, 'Status changed', auth.uid(), v_name, jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;
create trigger submissions_log_status_activity after update on public.submissions
for each row execute function public.log_submission_status_activity();


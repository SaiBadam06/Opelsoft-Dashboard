-- 0012_activity_status_assignment_triggers.sql
-- Log candidate stage/status/reassignment and requirement status changes.

create or replace function public.log_candidate_status_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  select full_name into v_name from public.profiles where id = auth.uid();

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.activity_logs(candidate_id, action, actor_id, actor_name, metadata)
    values (new.id, 'Status changed', auth.uid(), v_name, jsonb_build_object('from', old.status, 'to', new.status));
  end if;

  if tg_op = 'UPDATE' and new.pipeline_stage is distinct from old.pipeline_stage then
    insert into public.activity_logs(candidate_id, action, actor_id, actor_name, metadata)
    values (new.id, 'Stage changed', auth.uid(), v_name, jsonb_build_object('from', old.pipeline_stage, 'to', new.pipeline_stage));
  end if;

  if tg_op = 'UPDATE' and new.assigned_coordinator_id is distinct from old.assigned_coordinator_id then
    insert into public.activity_logs(candidate_id, action, actor_id, actor_name, metadata)
    values (
      new.id,
      'Coordinator reassigned',
      auth.uid(),
      v_name,
      jsonb_build_object('from', old.assigned_coordinator_id, 'to', new.assigned_coordinator_id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists candidates_log_status_activity on public.candidates;
create trigger candidates_log_status_activity
  after update on public.candidates
  for each row execute function public.log_candidate_status_activity();

create or replace function public.log_requirement_status_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  select full_name into v_name from public.profiles where id = auth.uid();

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.activity_logs(requirement_id, action, actor_id, actor_name, metadata)
    values (new.id, 'Status changed', auth.uid(), v_name, jsonb_build_object('from', old.status, 'to', new.status));
  end if;

  return new;
end;
$$;

drop trigger if exists requirements_log_status_activity on public.requirements;
create trigger requirements_log_status_activity
  after update on public.requirements
  for each row execute function public.log_requirement_status_activity();

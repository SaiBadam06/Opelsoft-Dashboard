-- 0009_activity_status_assignment_triggers.sql
-- Activity Log: triggers for status & assignment changes on candidates and requirements.
-- Fills the gap left by 0008 (which only logged creates + submission status).

-- Candidate: log pipeline_stage (status) changes and coordinator reassignment.
create or replace function public.log_candidate_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_old_coord text;
  v_new_coord text;
begin
  select full_name into v_name from public.profiles where id = auth.uid();

  if (new.pipeline_stage is distinct from old.pipeline_stage) then
    insert into public.activity_logs(candidate_id, action, actor_id, actor_name, metadata)
    values (new.id, 'Stage changed', auth.uid(), v_name,
      jsonb_build_object('from', old.pipeline_stage, 'to', new.pipeline_stage));
  end if;

  if (new.assigned_coordinator_id is distinct from old.assigned_coordinator_id) then
    select full_name into v_old_coord from public.profiles where id = old.assigned_coordinator_id;
    select full_name into v_new_coord from public.profiles where id = new.assigned_coordinator_id;
    insert into public.activity_logs(candidate_id, action, actor_id, actor_name, metadata)
    values (new.id, 'Reassigned', auth.uid(), v_name,
      jsonb_build_object('from', coalesce(v_old_coord, 'Unassigned'),
                         'to',   coalesce(v_new_coord, 'Unassigned')));
  end if;

  return new;
end;
$$;
create trigger candidates_log_update after update on public.candidates
for each row execute function public.log_candidate_changes();


-- Requirement: log status changes.
create or replace function public.log_requirement_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  select full_name into v_name from public.profiles where id = auth.uid();
  if (new.status is distinct from old.status) then
    insert into public.activity_logs(requirement_id, action, actor_id, actor_name, metadata)
    values (new.id, 'Status changed', auth.uid(), v_name,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;
create trigger requirements_log_update after update on public.requirements
for each row execute function public.log_requirement_changes();

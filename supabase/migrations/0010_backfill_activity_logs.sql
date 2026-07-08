-- 0010_backfill_activity_logs.sql
-- Backfill a baseline "created" activity entry for records that predate the 0008
-- triggers, so the Activity Logs tabs show history instead of being empty.
-- Idempotent: skips any record that already has its create entry.

insert into public.activity_logs (candidate_id, action, actor_id, actor_name, created_at)
select c.id, 'Consultant created', c.created_by, p.full_name, c.created_at
from public.candidates c
left join public.profiles p on p.id = c.created_by
where not exists (
  select 1 from public.activity_logs a
  where a.candidate_id = c.id and a.action = 'Consultant created'
);

insert into public.activity_logs (requirement_id, action, actor_id, actor_name, created_at)
select r.id, 'Requirement created', r.created_by, p.full_name, r.created_at
from public.requirements r
left join public.profiles p on p.id = r.created_by
where not exists (
  select 1 from public.activity_logs a
  where a.requirement_id = r.id and a.action = 'Requirement created'
);

insert into public.activity_logs (submission_id, action, actor_id, actor_name, created_at)
select s.id, 'Submission created', s.created_by, p.full_name, s.created_at
from public.submissions s
left join public.profiles p on p.id = s.created_by
where not exists (
  select 1 from public.activity_logs a
  where a.submission_id = s.id and a.action = 'Submission created'
);

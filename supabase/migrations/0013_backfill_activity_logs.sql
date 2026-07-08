-- 0013_backfill_activity_logs.sql
-- Idempotent baseline "created" entries for records that predate activity logging.

insert into public.activity_logs (candidate_id, action, actor_name, created_at)
select c.id, 'Consultant created', 'System', c.created_at
from public.candidates c
where not exists (
  select 1 from public.activity_logs al
  where al.candidate_id = c.id and al.action = 'Consultant created'
);

insert into public.activity_logs (requirement_id, action, actor_name, created_at)
select r.id, 'Requirement created', 'System', r.created_at
from public.requirements r
where not exists (
  select 1 from public.activity_logs al
  where al.requirement_id = r.id and al.action = 'Requirement created'
);

insert into public.activity_logs (submission_id, action, actor_name, created_at)
select s.id, 'Submission created', 'System', s.created_at
from public.submissions s
where not exists (
  select 1 from public.activity_logs al
  where al.submission_id = s.id and al.action = 'Submission created'
);

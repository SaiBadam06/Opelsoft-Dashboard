-- RLS for candidate_screenings (0015 created the table without it). Mirrors the
-- candidates policies: admins see all; a coordinator sees only screenings for
-- candidates assigned to them. Split as a follow-up migration because 0015 may
-- already be applied.
alter table public.candidate_screenings enable row level security;

create policy "candidate_screenings_select" on public.candidate_screenings
  for select using (
    public.is_admin() or exists (
      select 1 from public.candidates c
      where c.id = candidate_screenings.candidate_id
        and c.assigned_coordinator_id = auth.uid()
    )
  );

create policy "candidate_screenings_insert" on public.candidate_screenings
  for insert with check (
    public.is_admin() or exists (
      select 1 from public.candidates c
      where c.id = candidate_screenings.candidate_id
        and c.assigned_coordinator_id = auth.uid()
    )
  );

create policy "candidate_screenings_update" on public.candidate_screenings
  for update using (
    public.is_admin() or exists (
      select 1 from public.candidates c
      where c.id = candidate_screenings.candidate_id
        and c.assigned_coordinator_id = auth.uid()
    )
  );

create policy "candidate_screenings_delete" on public.candidate_screenings
  for delete using (
    public.is_admin() or exists (
      select 1 from public.candidates c
      where c.id = candidate_screenings.candidate_id
        and c.assigned_coordinator_id = auth.uid()
    )
  );

-- Candidate documents (resumes, certs, etc.) stored in Supabase Storage.
create type public.document_type as enum (
  'resume','cover_letter','certificate','id_proof','other'
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  type public.document_type not null default 'resume',
  file_name text not null,
  storage_path text not null,
  size_bytes bigint,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index documents_candidate_idx on public.documents(candidate_id);

alter table public.documents enable row level security;
create policy "documents_read" on public.documents for select to authenticated using (true);
create policy "documents_write" on public.documents for insert to authenticated with check (true);
create policy "documents_delete" on public.documents for delete to authenticated
  using (public.is_admin() or uploaded_by = auth.uid());

-- Private storage bucket for the files.
insert into storage.buckets (id, name, public)
values ('candidate-docs', 'candidate-docs', false)
on conflict (id) do nothing;

create policy "candidate-docs read" on storage.objects for select to authenticated
  using (bucket_id = 'candidate-docs');
create policy "candidate-docs insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'candidate-docs');
create policy "candidate-docs delete" on storage.objects for delete to authenticated
  using (bucket_id = 'candidate-docs');

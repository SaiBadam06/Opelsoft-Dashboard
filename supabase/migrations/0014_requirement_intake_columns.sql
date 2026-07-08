-- Requirement email intake: extra fields the AI extractor pulls from a vendor
-- email that the base requirements table (0003) doesn't have yet.
alter table public.requirements
  add column if not exists nice_to_have_skills text,
  add column if not exists work_authorization text,
  add column if not exists duration text,
  add column if not exists work_mode text,
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists source_email_text text;

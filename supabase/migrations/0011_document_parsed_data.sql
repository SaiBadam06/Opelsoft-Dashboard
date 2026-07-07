-- Store the AI-parsed resume JSON on its document row (resume rows only; other doc types stay null).
alter table public.documents add column if not exists parsed_data jsonb;

-- 0017_email_campaigns.sql — bulk email outreach: campaigns, recipients (send log), suppressions

create type public.email_campaign_status as enum ('draft','sending','paused','done','failed');
create type public.email_recipient_status as enum ('queued','sending','sent','failed','suppressed');
create type public.email_suppression_reason as enum ('unsubscribe','bounce','complaint','manual');

-- Campaigns
create table public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  body_html text not null,
  from_address text not null,
  reply_to text,
  status public.email_campaign_status not null default 'draft',
  total int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger email_campaigns_set_updated_at before update on public.email_campaigns
  for each row execute function public.set_updated_at();

-- Recipients = the send log
create table public.email_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete set null,
  email text not null,
  merge_data jsonb not null default '{}'::jsonb,
  status public.email_recipient_status not null default 'queued',
  attempts int not null default 0,
  last_error text,
  message_id text,
  unsubscribe_token uuid not null default gen_random_uuid(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, email)
);
create unique index email_recipients_token_idx on public.email_campaign_recipients(unsubscribe_token);
create index email_recipients_drain_idx on public.email_campaign_recipients(campaign_id, status, created_at);
create index email_recipients_sent_idx on public.email_campaign_recipients(sent_at) where status = 'sent';
create trigger email_recipients_set_updated_at before update on public.email_campaign_recipients
  for each row execute function public.set_updated_at();

-- Suppression list (never email these)
create table public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  reason public.email_suppression_reason not null,
  source_campaign_id uuid references public.email_campaigns(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index email_suppressions_email_idx on public.email_suppressions(lower(email));

-- Atomically claim a batch of queued recipients (safe across overlapping drain ticks)
create or replace function public.claim_email_batch(p_campaign uuid, p_limit int)
returns setof public.email_campaign_recipients
language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.email_campaign_recipients r
  set status = 'sending', attempts = r.attempts + 1
  where r.id in (
    select id from public.email_campaign_recipients
    where campaign_id = p_campaign and status = 'queued'
    order by created_at
    for update skip locked
    limit p_limit
  )
  returning r.*;
end;
$$;

-- Count 'sent' in trailing 24h for a from_address (daily-cap guard)
create or replace function public.email_sent_last_24h(p_from text)
returns int language sql security definer set search_path = public as $$
  select count(*)::int
  from public.email_campaign_recipients r
  join public.email_campaigns c on c.id = r.campaign_id
  where c.from_address = p_from and r.status = 'sent'
    and r.sent_at > now() - interval '24 hours';
$$;

-- RLS: shared workspace (authenticated read/write/update; admin delete). Service role bypasses RLS for the drain.
alter table public.email_campaigns enable row level security;
alter table public.email_campaign_recipients enable row level security;
alter table public.email_suppressions enable row level security;

create policy "email_campaigns_read"   on public.email_campaigns for select to authenticated using (true);
create policy "email_campaigns_write"  on public.email_campaigns for insert to authenticated with check (true);
create policy "email_campaigns_update" on public.email_campaigns for update to authenticated using (true);
create policy "email_campaigns_delete" on public.email_campaigns for delete to authenticated using (public.is_admin());

create policy "email_recipients_read"  on public.email_campaign_recipients for select to authenticated using (true);
create policy "email_recipients_write" on public.email_campaign_recipients for insert to authenticated with check (true);
create policy "email_recipients_update" on public.email_campaign_recipients for update to authenticated using (true);

create policy "email_suppressions_read"  on public.email_suppressions for select to authenticated using (true);
create policy "email_suppressions_write" on public.email_suppressions for insert to authenticated with check (true);
create policy "email_suppressions_delete" on public.email_suppressions for delete to authenticated using (public.is_admin());

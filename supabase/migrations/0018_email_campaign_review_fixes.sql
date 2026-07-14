-- 0018_email_campaign_review_fixes.sql — PR #18 review: lock down RPC grants, make campaign create atomic

-- SECURITY DEFINER functions default to PUBLIC execute via PostgREST; these two
-- mutate/aggregate across all campaigns and must only run from the service-role drain.
-- Supabase projects also grant EXECUTE to anon/authenticated directly (ALTER DEFAULT
-- PRIVILEGES set at project creation, not by this codebase) — revoking from PUBLIC
-- alone does not touch that; each role must be revoked by name too (verified live:
-- without these two lines an ordinary authenticated user could still call both RPCs).
revoke all on function public.claim_email_batch(uuid, int) from public, anon, authenticated;
revoke all on function public.email_sent_last_24h(text) from public, anon, authenticated;
grant execute on function public.claim_email_batch(uuid, int) to service_role;
grant execute on function public.email_sent_last_24h(text) to service_role;

-- Atomically insert a campaign + its recipients so a mid-way failure never leaves
-- a 'sending' campaign with total > 0 and zero recipient rows.
create or replace function public.create_email_campaign(
  p_name text, p_subject text, p_body_html text, p_from_address text, p_reply_to text,
  p_created_by uuid, p_recipients jsonb
) returns uuid language plpgsql set search_path = public as $$
declare
  v_campaign_id uuid;
begin
  insert into public.email_campaigns (name, subject, body_html, from_address, reply_to, status, total, created_by)
  values (p_name, p_subject, p_body_html, p_from_address, p_reply_to, 'sending', jsonb_array_length(p_recipients), p_created_by)
  returning id into v_campaign_id;

  insert into public.email_campaign_recipients (campaign_id, vendor_id, email, merge_data)
  select v_campaign_id, (r->>'vendor_id')::uuid, r->>'email', coalesce(r->'merge_data', '{}'::jsonb)
  from jsonb_array_elements(p_recipients) as r;

  return v_campaign_id;
end;
$$;
-- Not SECURITY DEFINER: runs as the calling (authenticated) user so the existing
-- email_campaigns_write / email_recipients_write RLS policies still gate it.
grant execute on function public.create_email_campaign(text, text, text, text, text, uuid, jsonb) to authenticated;

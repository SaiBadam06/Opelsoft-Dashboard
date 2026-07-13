import { createClient } from "@/lib/supabase/server";

export type CampaignStatus = "draft" | "sending" | "paused" | "done" | "failed";
export type RecipientStatus = "queued" | "sending" | "sent" | "failed" | "suppressed";

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  from_address: string;
  reply_to: string | null;
  status: CampaignStatus;
  total: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
}
export interface Recipient {
  id: string;
  email: string;
  status: RecipientStatus;
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
}

const CAMPAIGN_COLS =
  "id, name, subject, body_html, from_address, reply_to, status, total, sent_count, failed_count, created_at";

export async function listCampaigns(): Promise<Campaign[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("email_campaigns").select(CAMPAIGN_COLS).order("created_at", { ascending: false });
  return (data as Campaign[] | null) ?? [];
}
export async function getCampaign(id: string): Promise<Campaign | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("email_campaigns").select(CAMPAIGN_COLS).eq("id", id).single();
  return (data as Campaign | null) ?? null;
}
export async function listRecipients(campaignId: string): Promise<Recipient[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("email_campaign_recipients")
    .select("id, email, status, attempts, last_error, sent_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  return (data as Recipient[] | null) ?? [];
}

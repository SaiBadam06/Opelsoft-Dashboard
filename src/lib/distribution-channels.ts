import { createClient } from "@/lib/supabase/server";

export interface DistributionChannel {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

const CHANNEL_COLUMNS = "id, slug, name, is_active, created_at";

/** Channel registry for admin settings and posting distribution UI. */
export async function listDistributionChannels(): Promise<DistributionChannel[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("distribution_channels")
    .select(CHANNEL_COLUMNS)
    .order("slug");
  return (data as DistributionChannel[]) ?? [];
}

export const CHANNEL_DESCRIPTIONS: Record<string, string> = {
  careers_site:
    "Branded careers pages on company domains. Active — jobs publish via posting distributions.",
  linkedin:
    "LinkedIn job board sync. API integration deferred; UI shows as coming soon on posting card.",
  indeed:
    "Indeed job board sync. API integration deferred; UI shows as coming soon on posting card.",
  other: "Catch-all for referrals and other inbound sources.",
};

export function channelStatusLabel(channel: DistributionChannel): string {
  if (channel.slug === "careers_site" && channel.is_active) return "Active";
  if (!channel.is_active) return "Coming soon";
  return "Active";
}

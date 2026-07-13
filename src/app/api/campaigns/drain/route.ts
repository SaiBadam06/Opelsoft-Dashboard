import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { getSender } from "@/lib/email";
import { buildOutbound, unsubscribeUrl } from "@/lib/email/render";

export const dynamic = "force-dynamic";
const BATCH = 28;
const STALE_MIN = 5;

export async function POST(request: NextRequest) {
  if (request.headers.get("x-drain-secret") !== process.env.EMAIL_DRAIN_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = createServiceClient();

  // 1) Reaper: reset rows stuck in 'sending' (a crashed prior tick) back to 'queued'.
  await db
    .from("email_campaign_recipients")
    .update({ status: "queued" })
    .eq("status", "sending")
    .lt("updated_at", new Date(Date.now() - STALE_MIN * 60_000).toISOString());

  // 2) Pick the oldest active campaign; short-circuit if none.
  const { data: campaign } = await db
    .from("email_campaigns")
    .select("id, subject, body_html, from_address, reply_to")
    .eq("status", "sending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ idle: true });

  // 3) Daily cap for this from_address.
  const cap = Number(process.env.EMAIL_DAILY_CAP ?? 800);
  const { data: sentToday } = await db.rpc("email_sent_last_24h", { p_from: campaign.from_address });
  const remaining = Math.max(0, cap - (sentToday ?? 0));
  if (remaining === 0) return NextResponse.json({ capped: true });

  // 4) Atomically claim a batch.
  const { data: claimed } = await db.rpc("claim_email_batch", {
    p_campaign: campaign.id,
    p_limit: Math.min(BATCH, remaining),
  });
  const batch = (claimed as Array<{ id: string; email: string; merge_data: Record<string, string>; unsubscribe_token: string }> | null) ?? [];

  if (batch.length === 0) {
    // Nothing queued left → campaign is done.
    await db.from("email_campaigns").update({ status: "done" }).eq("id", campaign.id);
    return NextResponse.json({ done: campaign.id });
  }

  const base = process.env.APP_BASE_URL ?? "";
  const sender = getSender();
  let sent = 0, failed = 0;

  for (const r of batch) {
    // Last-mile suppression check (someone may have unsubscribed after enqueue).
    const { data: sup } = await db
      .from("email_suppressions").select("id").ilike("email", r.email).limit(1).maybeSingle();
    if (sup) {
      await db.from("email_campaign_recipients").update({ status: "suppressed" }).eq("id", r.id);
      continue;
    }
    try {
      const msg = buildOutbound({
        from: campaign.from_address,
        replyTo: campaign.reply_to ?? undefined,
        to: r.email,
        subject: campaign.subject,
        bodyTemplate: campaign.body_html,
        mergeData: r.merge_data ?? {},
        unsubUrl: unsubscribeUrl(base, r.unsubscribe_token),
      });
      const { id } = await sender.send(msg);
      await db.from("email_campaign_recipients")
        .update({ status: "sent", message_id: id, sent_at: new Date().toISOString(), last_error: null })
        .eq("id", r.id);
      sent++;
    } catch (e) {
      const status = (e as { status?: number }).status ?? 0;
      const retryable = status === 429 || status >= 500;
      await db.from("email_campaign_recipients")
        .update({ status: retryable ? "queued" : "failed", last_error: String((e as Error).message).slice(0, 500) })
        .eq("id", r.id);
      if (!retryable) failed++;
      if (status === 429) break; // back off this tick; pg_cron retries in 60s
    }
  }

  // 5) Update campaign counters.
  await db.from("email_campaigns")
    .update({
      sent_count: await countBy(db, campaign.id, "sent"),
      failed_count: await countBy(db, campaign.id, "failed"),
    })
    .eq("id", campaign.id);

  return NextResponse.json({ campaign: campaign.id, sent, failed });
}

async function countBy(db: ReturnType<typeof createServiceClient>, campaignId: string, status: string): Promise<number> {
  const { count } = await db
    .from("email_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", status);
  return count ?? 0;
}

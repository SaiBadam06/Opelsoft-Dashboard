"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { dedupe, validate, parseManualList, parseSpreadsheet, type ParsedRecipient } from "@/lib/email/recipients";
import { senderFor } from "@/lib/email/sender-address";

export async function createAndStartCampaign(_prev: unknown, fd: FormData) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };

  const name = String(fd.get("name") ?? "").trim();
  const subject = String(fd.get("subject") ?? "").trim();
  const body_html = String(fd.get("body_html") ?? "").trim();
  const reply_to = String(fd.get("reply_to") ?? "").trim() || null;
  if (!name || !subject || !body_html) return { error: "Name, subject and body are required." };
  // From is derived from the logged-in user (see senderFor), never trusted from the form.
  const from_address = senderFor(me);
  if (!from_address) return { error: "No sender mailbox configured (EMAIL_SENDER_ADDRESSES)." };

  const supabase = await createClient();

  // Gather recipients from the 3 sources. Vendors go first: dedupe() keeps the
  // FIRST occurrence of an email, and vendor rows carry merge data
  // (contact_name/vendor_name) that manual/file entries don't — a vendor
  // duplicated in the paste box must not lose that data to a blank manual entry.
  const recipients: ParsedRecipient[] = [];
  const vendorIdsRaw = String(fd.get("vendor_ids") ?? "").trim();
  const vendorMap = new Map<string, string>(); // email -> vendor_id
  if (vendorIdsRaw) {
    const ids = vendorIdsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    const { data: vs } = await supabase.from("vendors").select("id, email, contact_name, name").in("id", ids);
    for (const v of vs ?? []) {
      if (!v.email) continue;
      recipients.push({ email: v.email, mergeData: { contact_name: v.contact_name ?? "", vendor_name: v.name ?? "" } });
      vendorMap.set(v.email.toLowerCase(), v.id);
    }
  }

  const manual = String(fd.get("manual") ?? "").trim();
  if (manual) recipients.push(...parseManualList(manual));

  const file = fd.get("file");
  if (file && file instanceof File && file.size > 0) {
    recipients.push(...parseSpreadsheet(await file.arrayBuffer()));
  }

  const { valid } = validate(dedupe(recipients));
  if (valid.length === 0) return { error: "No valid recipients found." };

  // Drop anyone already suppressed.
  const { data: sups } = await supabase.from("email_suppressions").select("email");
  const suppressed = new Set((sups ?? []).map((s) => s.email.toLowerCase()));
  const finalRecipients = valid.filter((r) => !suppressed.has(r.email));
  if (finalRecipients.length === 0) return { error: "All recipients are on the suppression list." };

  // Create campaign (status sending) then insert recipient rows.
  const { data: campaign, error: cErr } = await supabase
    .from("email_campaigns")
    .insert({ name, subject, body_html, from_address, reply_to, status: "sending", total: finalRecipients.length, created_by: me.id })
    .select("id")
    .single();
  if (cErr || !campaign) return { error: cErr?.message ?? "Failed to create campaign." };

  const rows = finalRecipients.map((r) => ({
    campaign_id: campaign.id,
    vendor_id: vendorMap.get(r.email) ?? null,
    email: r.email,
    merge_data: r.mergeData,
  }));
  const { error: rErr } = await supabase.from("email_campaign_recipients").insert(rows);
  if (rErr) return { error: rErr.message };

  revalidatePath("/campaigns");
  redirect(`/campaigns/${campaign.id}`);
}

export async function setCampaignStatus(id: string, status: "sending" | "paused") {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const supabase = await createClient();
  const { error } = await supabase.from("email_campaigns").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/campaigns/${id}`);
  return { ok: true as const };
}

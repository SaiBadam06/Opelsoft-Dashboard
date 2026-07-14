"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { dedupe, validate, parseManualList, parseSpreadsheet, type ParsedRecipient } from "@/lib/email/recipients";
import { senderFor } from "@/lib/email/sender-address";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

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
    if (file.size > MAX_FILE_BYTES) return { error: "Spreadsheet is too large (max 5MB)." };
    recipients.push(...parseSpreadsheet(await file.arrayBuffer()));
  }

  const { valid } = validate(dedupe(recipients));
  if (valid.length === 0) return { error: "No valid recipients found." };

  // Drop anyone already suppressed.
  const { data: sups } = await supabase.from("email_suppressions").select("email");
  const suppressed = new Set((sups ?? []).map((s) => s.email.toLowerCase()));
  const finalRecipients = valid.filter((r) => !suppressed.has(r.email));
  if (finalRecipients.length === 0) return { error: "All recipients are on the suppression list." };

  // Campaign + recipients insert atomically in one RPC — a mid-way failure must
  // never leave a 'sending' campaign with total > 0 and zero recipient rows.
  const { data: campaignId, error: cErr } = await supabase.rpc("create_email_campaign", {
    p_name: name,
    p_subject: subject,
    p_body_html: body_html,
    p_from_address: from_address,
    p_reply_to: reply_to,
    p_created_by: me.id,
    p_recipients: finalRecipients.map((r) => ({
      email: r.email,
      vendor_id: vendorMap.get(r.email) ?? null,
      merge_data: r.mergeData,
    })),
  });
  if (cErr || !campaignId) return { error: cErr?.message ?? "Failed to create campaign." };

  revalidatePath("/campaigns");
  redirect(`/campaigns/${campaignId}`);
}

export async function setCampaignStatus(id: string, status: "sending" | "paused") {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const supabase = await createClient();
  // Only sending<->paused is a valid manual transition; never reopen a done/failed campaign.
  const { data: campaign } = await supabase.from("email_campaigns").select("status").eq("id", id).single();
  if (!campaign || (campaign.status !== "sending" && campaign.status !== "paused")) {
    return { error: "Campaign can't be paused or resumed from its current status." };
  }
  const { error } = await supabase.from("email_campaigns").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/campaigns/${id}`);
  return { ok: true as const };
}

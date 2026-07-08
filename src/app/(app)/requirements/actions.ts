"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { extractRequirement as runExtract } from "@/lib/ai/extract-requirement";
import {
  toFormValues,
  type IntakeFormValues,
  type VendorOption,
} from "@/lib/intake-map";
import type {
  RequirementPriority,
  RequirementStatus,
} from "@/lib/job-constants";

function str(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
}
function num(fd: FormData, k: string): number | null {
  const v = str(fd, k);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function payload(fd: FormData) {
  return {
    title: String(fd.get("title") ?? "").trim(),
    vendor_id: str(fd, "vendor_id"),
    end_client: str(fd, "end_client"),
    experience: str(fd, "experience"),
    skills: str(fd, "skills"),
    location: str(fd, "location"),
    remote: ["on", "true", "1"].includes(
      String(fd.get("remote") ?? "").toLowerCase(),
    ),
    rate: num(fd, "rate"),
    employment_type: str(fd, "employment_type"),
    priority: (str(fd, "priority") ?? "medium") as RequirementPriority,
    status: (str(fd, "status") ?? "open") as RequirementStatus,
    closing_date: str(fd, "closing_date"),
    notes: str(fd, "notes"),
  };
}

export async function createRequirement(_prev: unknown, fd: FormData) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const p = payload(fd);
  if (!p.title) return { error: "Title is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("requirements")
    .insert({ ...p, created_by: me.id })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/requirements");
  redirect(`/requirements/${data.id}`);
}

export async function updateRequirement(_prev: unknown, fd: FormData) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const id = String(fd.get("id") ?? "");
  if (!id) return { error: "Missing id." };
  const p = payload(fd);
  if (!p.title) return { error: "Title is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("requirements").update(p).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/requirements");
  revalidatePath(`/requirements/${id}`);
  redirect(`/requirements/${id}`);
}

export async function setRequirementStatus(
  id: string,
  status: RequirementStatus,
) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("requirements")
    .update({ status })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/requirements");
  revalidatePath(`/requirements/${id}`);
  return { ok: true as const };
}

export async function setRequirementPriority(
  id: string,
  priority: RequirementPriority,
) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("requirements")
    .update({ priority })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/requirements");
  revalidatePath(`/requirements/${id}`);
  return { ok: true as const };
}

export async function deleteRequirement(id: string) {
  const me = await getCurrentProfile();
  if (me?.role !== "admin") return { error: "Only admins can delete." };
  const supabase = await createClient();
  const { error } = await supabase.from("requirements").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/requirements");
  redirect("/requirements");
}

// ─── Email intake ────────────────────────────────────────────────────────

// Parse a "$70/hr C2C" style rate down to a number; null if none. (The base
// `num` above expects a clean numeric string; email rates carry currency/units.)
function rateNum(fd: FormData, k: string): number | null {
  const v = str(fd, k);
  if (v === null) return null;
  const m = v.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

// AI extraction. No DB write — returns pre-filled form values for review.
export async function extractRequirementAction(
  emailText: string,
  vendors: VendorOption[],
): Promise<{ values: IntakeFormValues } | { error: string }> {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const text = emailText.trim();
  if (!text) return { error: "Paste the email text first." };
  const extracted = await runExtract(text);
  if (!extracted) {
    return { error: "Couldn't parse the email. Fill the fields in manually." };
  }
  return { values: toFormValues(extracted, vendors) };
}

// A requirement is a likely duplicate if the same title (case-insensitive) from
// the same vendor — or same end client when there's no vendor — was created
// within this window. Tuned to catch re-blasts, not legitimate later re-posts.
const DUP_WINDOW_DAYS = 30;
const normTitle = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

async function findDuplicate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opts: { title: string; vendorId: string | null; endClient: string | null },
): Promise<{ id: string; title: string; created_at: string } | null> {
  const since = new Date(
    Date.now() - DUP_WINDOW_DAYS * 86_400_000,
  ).toISOString();
  let q = supabase
    .from("requirements")
    .select("id, title, created_at")
    .gte("created_at", since);
  if (opts.vendorId) q = q.eq("vendor_id", opts.vendorId);
  else if (opts.endClient) q = q.eq("end_client", opts.endClient);
  else return null; // no vendor/client to scope by — don't flag on title alone
  const { data } = await q;
  const match = (data ?? []).find(
    (r) => normTitle(r.title as string) === normTitle(opts.title),
  );
  return (match as { id: string; title: string; created_at: string }) ?? null;
}

// Confirmation step from the email-intake review form: creates the requirement,
// storing the original email text and the richer extracted fields.
export async function createRequirementFromIntake(
  _prev: unknown,
  fd: FormData,
) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const title = String(fd.get("title") ?? "").trim();
  if (!title) return { error: "Title is required." };

  const supabase = await createClient();

  // Duplicate guard (skipped when the user chose "Create anyway").
  if (fd.get("force") !== "1") {
    const dup = await findDuplicate(supabase, {
      title,
      vendorId: str(fd, "vendor_id"),
      endClient: str(fd, "end_client"),
    });
    if (dup) {
      return {
        duplicate: { id: dup.id, title: dup.title, created_at: dup.created_at },
      };
    }
  }

  // Vendor: use the picked id, or add the email's vendor ONLY when the user
  // explicitly ticked the confirm box.
  let vendorId = str(fd, "vendor_id");
  const addVendor = fd.get("add_vendor") === "on";
  const newVendorName = str(fd, "new_vendor_name");
  if (!vendorId && addVendor && newVendorName) {
    const { data: v, error: vErr } = await supabase
      .from("vendors")
      .insert({
        name: newVendorName,
        email: str(fd, "new_vendor_email"),
        contact_name: str(fd, "new_vendor_contact"),
      })
      .select("id")
      .single();
    if (vErr) return { error: `Vendor create failed: ${vErr.message}` };
    vendorId = v.id;
  }

  const workMode = str(fd, "work_mode");
  const payload = {
    title,
    vendor_id: vendorId,
    end_client: str(fd, "end_client"),
    location: str(fd, "location"),
    skills: str(fd, "skills"),
    nice_to_have_skills: str(fd, "nice_to_have_skills"),
    work_authorization: str(fd, "work_authorization"),
    duration: str(fd, "duration"),
    rate: rateNum(fd, "rate"),
    work_mode: workMode,
    remote: workMode === "remote", // keep the base `remote` flag in sync
    priority: (str(fd, "priority") ?? "medium") as RequirementPriority,
    status: (str(fd, "status") ?? "open") as RequirementStatus,
    closing_date: str(fd, "closing_date"),
    contact_name: str(fd, "contact_name"),
    contact_email: str(fd, "contact_email"),
    source_email_text: str(fd, "source_email_text"),
    created_by: me.id,
  };

  const { data, error } = await supabase
    .from("requirements")
    .insert(payload)
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/requirements");
  redirect(`/requirements/${data.id}`);
}

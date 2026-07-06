"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import type { PrimeLayer, SubmissionStatus } from "@/lib/job-constants";

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

export async function createSubmission(_prev: unknown, fd: FormData) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const candidate_id = str(fd, "candidate_id");
  if (!candidate_id) return { error: "Pick a candidate." };

  const supabase = await createClient();
  const { error } = await supabase.from("submissions").insert({
    candidate_id,
    requirement_id: str(fd, "requirement_id"),
    vendor_id: str(fd, "vendor_id"),
    end_client: str(fd, "end_client"),
    prime_layer: str(fd, "prime_layer") as PrimeLayer | null,
    rate: num(fd, "rate"),
    submitted_date: str(fd, "submitted_date") ?? undefined,
    resume_version: str(fd, "resume_version"),
    status: (str(fd, "status") ?? "submitted") as SubmissionStatus,
    notes: str(fd, "notes"),
    created_by: me.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/submissions");
  redirect("/submissions");
}

export async function setSubmissionStatus(
  id: string,
  status: SubmissionStatus,
) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("submissions")
    .update({ status })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/submissions");
  revalidatePath(`/submissions/${id}`);
  revalidatePath("/logs");
  return { ok: true as const };
}

export async function deleteSubmission(id: string) {
  const me = await getCurrentProfile();
  if (me?.role !== "admin") return { error: "Only admins can delete." };
  const supabase = await createClient();
  const { error } = await supabase.from("submissions").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/submissions");
  return { ok: true as const };
}

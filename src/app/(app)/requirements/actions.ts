"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
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

export async function deleteRequirement(id: string) {
  const me = await getCurrentProfile();
  if (me?.role !== "admin") return { error: "Only admins can delete." };
  const supabase = await createClient();
  const { error } = await supabase.from("requirements").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/requirements");
  redirect("/requirements");
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import type { PlacementStatus } from "@/lib/work-constants";

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

export async function createPlacement(_prev: unknown, fd: FormData) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const candidate_id = str(fd, "candidate_id");
  if (!candidate_id) return { error: "Pick a candidate." };

  const supabase = await createClient();
  const { error } = await supabase.from("placements").insert({
    candidate_id,
    recruiter: str(fd, "recruiter"),
    opt_recruiter: str(fd, "opt_recruiter"),
    vendor_id: str(fd, "vendor_id"),
    end_client: str(fd, "end_client"),
    new_exp: str(fd, "new_exp"),
    rate: num(fd, "rate"),
    placement_date: str(fd, "placement_date"),
    project_start_date: str(fd, "project_start_date"),
    bgv_date: str(fd, "bgv_date"),
    in_out: str(fd, "in_out"),
    project_end_date: str(fd, "project_end_date"),
    feedback: str(fd, "feedback"),
    status: (str(fd, "status") ?? "active") as PlacementStatus,
    created_by: me.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/placements");
  redirect("/placements");
}

export async function setPlacementStatus(id: string, status: PlacementStatus) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("placements")
    .update({ status })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/placements");
  return { ok: true as const };
}

export async function deletePlacement(id: string) {
  const me = await getCurrentProfile();
  if (me?.role !== "admin") return { error: "Only admins can delete." };
  const supabase = await createClient();
  const { error } = await supabase.from("placements").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/placements");
  return { ok: true as const };
}

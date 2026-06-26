"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

function str(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
}

export async function createVendor(_prev: unknown, fd: FormData) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return { error: "Vendor name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("vendors").insert({
    name,
    contact_name: str(fd, "contact_name"),
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    notes: str(fd, "notes"),
    created_by: me.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/vendors");
  redirect("/vendors");
}

export async function updateVendor(_prev: unknown, fd: FormData) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const id = String(fd.get("id") ?? "");
  const name = String(fd.get("name") ?? "").trim();
  if (!id) return { error: "Missing id." };
  if (!name) return { error: "Vendor name is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("vendors")
    .update({
      name,
      contact_name: str(fd, "contact_name"),
      email: str(fd, "email"),
      phone: str(fd, "phone"),
      notes: str(fd, "notes"),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/vendors");
  redirect("/vendors");
}

export async function deleteVendor(id: string) {
  const me = await getCurrentProfile();
  if (me?.role !== "admin") return { error: "Only admins can delete." };
  const supabase = await createClient();
  const { error } = await supabase.from("vendors").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/vendors");
  return { ok: true as const };
}

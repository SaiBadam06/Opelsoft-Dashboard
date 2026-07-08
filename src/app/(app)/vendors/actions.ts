"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import type { VendorOption } from "@/lib/vendors";

function str(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function createVendorForCombobox(input: {
  vendorName: string;
  company: string;
  email: string;
}): Promise<{ vendor?: VendorOption; error?: string; duplicate?: boolean }> {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };

  const vendorName = input.vendorName.trim();
  const company = input.company.trim();
  const email = input.email.trim();

  if (!vendorName) return { error: "Vendor / Client Name is required." };
  if (!company) return { error: "Company is required." };
  if (!email) return { error: "Email is required." };
  if (!validEmail(email)) {
    return { error: "Please enter a valid email address." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("vendors")
    .select("id, name, contact_name, email")
    .or(
      `email.ilike.${email},name.ilike.${company},contact_name.ilike.${vendorName}`,
    )
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { vendor: existing as VendorOption, duplicate: true };
  }

  const { data, error } = await supabase
    .from("vendors")
    .insert({
      name: company,
      contact_name: vendorName,
      email,
      created_by: me.id,
    })
    .select("id, name, contact_name, email")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/vendors");
  revalidatePath("/submissions/new");
  return { vendor: data as VendorOption };
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

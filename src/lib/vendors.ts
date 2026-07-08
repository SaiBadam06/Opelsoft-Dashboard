import { createClient } from "@/lib/supabase/server";

export interface Vendor {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type VendorOption = Pick<Vendor, "id" | "name" | "contact_name" | "email">;

const COLUMNS =
  "id, name, contact_name, email, phone, notes, created_at, updated_at";

export async function listVendors(): Promise<Vendor[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendors")
    .select(COLUMNS)
    .order("name", { ascending: true });
  return (data as Vendor[] | null) ?? [];
}

export async function getVendor(id: string): Promise<Vendor | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendors")
    .select(COLUMNS)
    .eq("id", id)
    .single();
  return (data as Vendor | null) ?? null;
}

// Lightweight list for select and combobox inputs.
export async function vendorOptions(): Promise<VendorOption[]> {
  const vendors = await listVendors();
  return vendors.map((v) => ({
    id: v.id,
    name: v.name,
    contact_name: v.contact_name,
    email: v.email,
  }));
}

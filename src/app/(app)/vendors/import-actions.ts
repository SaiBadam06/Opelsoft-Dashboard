"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { mapRow, VENDOR_ALIASES, type RawRow } from "@/lib/import-maps";

export async function importVendors(rows: RawRow[]) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "No rows to import." };
  }

  const records = [];
  for (const row of rows) {
    const m = mapRow(row, VENDOR_ALIASES);
    if (!m.name) continue;
    records.push({
      name: m.name,
      contact_name: m.contact_name ?? null,
      email: m.email ?? null,
      phone: m.phone ?? null,
      notes: m.notes ?? null,
      created_by: me.id,
    });
  }

  if (records.length === 0) {
    return { error: "No valid rows — the sheet needs a 'Name' or 'Company' column." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("vendors").insert(records);
  if (error) return { error: error.message };
  revalidatePath("/vendors");
  return {
    ok: true as const,
    inserted: records.length,
    skipped: rows.length - records.length,
  };
}

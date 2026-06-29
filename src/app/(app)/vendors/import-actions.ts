"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  mapRow,
  validateText,
  validateEmail,
  VENDOR_ALIASES,
  type RawRow,
  type RowError,
} from "@/lib/import-maps";

export async function importVendors(rows: RawRow[]) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  if (!Array.isArray(rows) || rows.length === 0)
    return { error: "No rows to import." };

  const rowErrors: RowError[] = [];
  for (let i = 0; i < rows.length; i++) {
    const m = mapRow(rows[i], VENDOR_ALIASES);
    const rowNum = i + 2;
    if (!m.name) {
      rowErrors.push({ row: rowNum, field: "Name", issue: "Required field is missing" });
      continue;
    }
    const checks = [
      validateText(m.name, "Name", rowNum),
      validateEmail(m.email, "Email", rowNum),
    ];
    checks.forEach((e) => e && rowErrors.push(e));
  }
  if (rowErrors.length > 0) return { error: "Validation failed", rowErrors };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("vendors").select("name");
  const existingNames = new Set(
    (existing ?? []).map((v) => v.name?.toLowerCase()),
  );

  const records = [];
  let duplicates = 0;
  for (const row of rows) {
    const m = mapRow(row, VENDOR_ALIASES);
    if (!m.name) continue;
    if (existingNames.has(m.name.toLowerCase())) {
      duplicates++;
      continue;
    }
    records.push({
      name: m.name,
      contact_name: m.contact_name ?? null,
      email: m.email ?? null,
      phone: m.phone ?? null,
      notes: m.notes ?? null,
      created_by: me.id,
    });
  }

  if (records.length === 0)
    return { error: "No new rows — all vendors already exist in the system.", rowErrors: [] };

  const { error } = await supabase.from("vendors").insert(records);
  if (error) return { error: error.message };
  revalidatePath("/vendors");
  return {
    ok: true as const,
    inserted: records.length,
    skipped: rows.length - records.length - duplicates,
    duplicates,
  };
}

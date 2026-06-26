"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  mapRow,
  parseNumber,
  CANDIDATE_ALIASES,
  type RawRow,
} from "@/lib/import-maps";

export async function importCandidates(rows: RawRow[]) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "No rows to import." };
  }

  const records = [];
  for (const row of rows) {
    const m = mapRow(row, CANDIDATE_ALIASES);
    if (!m.full_name) continue;
    records.push({
      full_name: m.full_name,
      email: m.email ?? null,
      phone: m.phone ?? null,
      location: m.location ?? null,
      experience_years: parseNumber(m.experience_years),
      current_company: m.current_company ?? null,
      rate: parseNumber(m.rate),
      visa: m.visa ?? null,
      relocation: m.relocation ?? null,
      availability: m.availability ?? null,
      primary_skills: m.primary_skills ?? null,
      notes: m.notes ?? null,
      assigned_coordinator_id: me.id,
      created_by: me.id,
      updated_by: me.id,
    });
  }

  if (records.length === 0) {
    return {
      error: "No valid rows — the sheet needs a 'Consultant Name' or 'Name' column.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("candidates").insert(records);
  if (error) return { error: error.message };
  revalidatePath("/candidates");
  revalidatePath("/pipeline");
  return {
    ok: true as const,
    inserted: records.length,
    skipped: rows.length - records.length,
  };
}

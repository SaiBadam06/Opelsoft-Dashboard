"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  mapRow,
  parseNumber,
  validateText,
  validateEmail,
  validateNumeric,
  CANDIDATE_ALIASES,
  type RawRow,
  type RowError,
} from "@/lib/import-maps";

export async function importCandidates(rows: RawRow[]) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  if (!Array.isArray(rows) || rows.length === 0)
    return { error: "No rows to import." };

  // Validate every row first — collect all errors before touching the DB.
  const rowErrors: RowError[] = [];
  for (let i = 0; i < rows.length; i++) {
    const m = mapRow(rows[i], CANDIDATE_ALIASES);
    const rowNum = i + 2; // +2: 1-based + header row
    if (!m.full_name) {
      rowErrors.push({ row: rowNum, field: "Name", issue: "Required field is missing" });
      continue;
    }
    const checks = [
      validateText(m.full_name, "Name", rowNum),
      validateEmail(m.email, "Email", rowNum),
      validateNumeric(m.experience_years, "Experience", rowNum),
      validateNumeric(m.rate, "Rate", rowNum),
    ];
    checks.forEach((e) => e && rowErrors.push(e));
  }
  if (rowErrors.length > 0) return { error: "Validation failed", rowErrors };

  // Duplicate detection: skip rows whose email OR name already exists.
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("candidates")
    .select("full_name, email");
  const existingEmails = new Set(
    (existing ?? []).map((c) => c.email?.toLowerCase()).filter(Boolean),
  );
  const existingNames = new Set(
    (existing ?? []).map((c) => c.full_name?.toLowerCase()),
  );

  const records = [];
  let duplicates = 0;
  for (const row of rows) {
    const m = mapRow(row, CANDIDATE_ALIASES);
    if (!m.full_name) continue;
    const emailKey = m.email?.toLowerCase();
    const nameKey = m.full_name.toLowerCase();
    if (
      (emailKey && existingEmails.has(emailKey)) ||
      existingNames.has(nameKey)
    ) {
      duplicates++;
      continue;
    }
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

  if (records.length === 0)
    return { error: "No new rows — all entries already exist in the system.", rowErrors: [] };

  const { error } = await supabase.from("candidates").insert(records);
  if (error) return { error: error.message };
  revalidatePath("/candidates");
  revalidatePath("/pipeline");
  return {
    ok: true as const,
    inserted: records.length,
    skipped: rows.length - records.length - duplicates,
    duplicates,
  };
}

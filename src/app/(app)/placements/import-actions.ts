"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  mapRow,
  parseNumber,
  parseDate,
  validateNumeric,
  validateDateField,
  PLACEMENT_ALIASES,
  type RawRow,
  type RowError,
} from "@/lib/import-maps";

export async function importPlacements(rows: RawRow[]) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  if (!Array.isArray(rows) || rows.length === 0)
    return { error: "No rows to import." };

  const rowErrors: RowError[] = [];
  for (let i = 0; i < rows.length; i++) {
    const m = mapRow(rows[i], PLACEMENT_ALIASES);
    const rowNum = i + 2;
    if (!m.candidate) {
      rowErrors.push({ row: rowNum, field: "Candidate Name", issue: "Required field is missing" });
      continue;
    }
    const checks = [
      validateNumeric(m.rate, "Rate", rowNum),
      validateDateField(m.placement_date, "Placement Date", rowNum),
      validateDateField(m.project_start_date, "Project Start Date", rowNum),
      validateDateField(m.bgv_date, "BGV Date", rowNum),
      validateDateField(m.project_end_date, "Project End Date", rowNum),
    ];
    checks.forEach((e) => e && rowErrors.push(e));
  }
  if (rowErrors.length > 0) return { error: "Validation failed", rowErrors };

  const supabase = await createClient();
  const { data: cands } = await supabase.from("candidates").select("id, full_name");
  const { data: vends } = await supabase.from("vendors").select("id, name");
  const { data: existingPlacements } = await supabase
    .from("placements")
    .select("candidate_id, placement_date");

  const candByName = new Map(
    (cands ?? []).map((c) => [c.full_name.toLowerCase().trim(), c.id as string]),
  );
  const vendByName = new Map(
    (vends ?? []).map((v) => [v.name.toLowerCase().trim(), v.id as string]),
  );
  const placementKeys = new Set(
    (existingPlacements ?? []).map((p) => `${p.candidate_id}|${p.placement_date}`),
  );

  async function resolveCandidate(name: string): Promise<string | null> {
    const key = name.toLowerCase().trim();
    const existing = candByName.get(key);
    if (existing) return existing;
    const { data } = await supabase
      .from("candidates")
      .insert({ full_name: name, assigned_coordinator_id: me!.id, created_by: me!.id, updated_by: me!.id })
      .select("id")
      .single();
    if (data?.id) candByName.set(key, data.id);
    return data?.id ?? null;
  }

  async function resolveVendor(name: string): Promise<string | null> {
    const key = name.toLowerCase().trim();
    const existing = vendByName.get(key);
    if (existing) return existing;
    const { data } = await supabase
      .from("vendors")
      .insert({ name, created_by: me!.id })
      .select("id")
      .single();
    if (data?.id) vendByName.set(key, data.id);
    return data?.id ?? null;
  }

  const toInsert = [];
  let skipped = 0;
  let duplicates = 0;
  for (const row of rows) {
    const m = mapRow(row, PLACEMENT_ALIASES);
    if (!m.candidate) { skipped++; continue; }
    const candidate_id = await resolveCandidate(m.candidate);
    if (!candidate_id) { skipped++; continue; }
    const placementDate = parseDate(m.placement_date);
    const dupKey = `${candidate_id}|${placementDate}`;
    if (placementDate && placementKeys.has(dupKey)) { duplicates++; continue; }
    if (placementDate) placementKeys.add(dupKey);
    const vendor_id = m.vendor ? await resolveVendor(m.vendor) : null;
    toInsert.push({
      candidate_id,
      vendor_id,
      end_client: m.end_client ?? null,
      recruiter: m.recruiter ?? null,
      opt_recruiter: m.opt_recruiter ?? null,
      new_exp: m.new_exp ?? null,
      rate: parseNumber(m.rate),
      placement_date: placementDate,
      project_start_date: parseDate(m.project_start_date),
      bgv_date: parseDate(m.bgv_date),
      in_out: m.in_out ?? null,
      project_end_date: parseDate(m.project_end_date),
      feedback: m.feedback ?? null,
      status: "active" as const,
      created_by: me.id,
    });
  }

  if (toInsert.length === 0)
    return { error: "No new rows — all entries already exist or were invalid.", rowErrors: [] };

  const { error } = await supabase.from("placements").insert(toInsert);
  if (error) return { error: error.message };
  revalidatePath("/placements");
  return { ok: true as const, inserted: toInsert.length, skipped, duplicates };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  mapRow,
  parseNumber,
  parseDate,
  PLACEMENT_ALIASES,
  type RawRow,
} from "@/lib/import-maps";

export async function importPlacements(rows: RawRow[]) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "No rows to import." };
  }

  const supabase = await createClient();
  const { data: cands } = await supabase
    .from("candidates")
    .select("id, full_name");
  const { data: vends } = await supabase.from("vendors").select("id, name");
  const candByName = new Map(
    (cands ?? []).map((c) => [c.full_name.toLowerCase().trim(), c.id as string]),
  );
  const vendByName = new Map(
    (vends ?? []).map((v) => [v.name.toLowerCase().trim(), v.id as string]),
  );

  async function resolveCandidate(name: string): Promise<string | null> {
    const key = name.toLowerCase().trim();
    const existing = candByName.get(key);
    if (existing) return existing;
    const { data } = await supabase
      .from("candidates")
      .insert({
        full_name: name,
        assigned_coordinator_id: me!.id,
        created_by: me!.id,
        updated_by: me!.id,
      })
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
  for (const row of rows) {
    const m = mapRow(row, PLACEMENT_ALIASES);
    if (!m.candidate) {
      skipped++;
      continue;
    }
    const candidate_id = await resolveCandidate(m.candidate);
    if (!candidate_id) {
      skipped++;
      continue;
    }
    const vendor_id = m.vendor ? await resolveVendor(m.vendor) : null;
    toInsert.push({
      candidate_id,
      vendor_id,
      end_client: m.end_client ?? null,
      recruiter: m.recruiter ?? null,
      opt_recruiter: m.opt_recruiter ?? null,
      new_exp: m.new_exp ?? null,
      rate: parseNumber(m.rate),
      placement_date: parseDate(m.placement_date),
      project_start_date: parseDate(m.project_start_date),
      bgv_date: parseDate(m.bgv_date),
      in_out: m.in_out ?? null,
      project_end_date: parseDate(m.project_end_date),
      feedback: m.feedback ?? null,
      status: "active" as const,
      created_by: me.id,
    });
  }

  if (toInsert.length === 0) {
    return { error: "No valid rows — need a 'Consultant Name' column." };
  }
  const { error } = await supabase.from("placements").insert(toInsert);
  if (error) return { error: error.message };
  revalidatePath("/placements");
  return { ok: true as const, inserted: toInsert.length, skipped };
}

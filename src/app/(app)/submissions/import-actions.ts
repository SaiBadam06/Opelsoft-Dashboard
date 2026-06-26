"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  mapRow,
  parseNumber,
  parseDate,
  SUBMISSION_ALIASES,
  type RawRow,
} from "@/lib/import-maps";
import type { PrimeLayer, SubmissionStatus } from "@/lib/job-constants";

function normStatus(v: string | undefined): SubmissionStatus {
  const s = (v ?? "").toLowerCase();
  if (s.includes("interview")) return "interview_scheduled";
  if (s.includes("view")) return "viewed";
  if (s.includes("reject")) return "rejected";
  if (s.includes("offer")) return "offer";
  return "submitted";
}

function normPrimeLayer(v: string | undefined): PrimeLayer | null {
  const s = (v ?? "").toLowerCase();
  if (s.includes("prime")) return "prime";
  if (s.includes("layer")) return "layer";
  return null;
}

export async function importSubmissions(rows: RawRow[]) {
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
    const m = mapRow(row, SUBMISSION_ALIASES);
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
      prime_layer: normPrimeLayer(m.prime_layer),
      rate: parseNumber(m.rate),
      submitted_date: parseDate(m.submitted_date) ?? undefined,
      status: normStatus(m.status),
      created_by: me.id,
    });
  }

  if (toInsert.length === 0) {
    return { error: "No valid rows — need a 'Consultant Name' column." };
  }
  const { error } = await supabase.from("submissions").insert(toInsert);
  if (error) return { error: error.message };
  revalidatePath("/submissions");
  return { ok: true as const, inserted: toInsert.length, skipped };
}

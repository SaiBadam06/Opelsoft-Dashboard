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
  SUBMISSION_ALIASES,
  type RawRow,
  type RowError,
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
  if (!Array.isArray(rows) || rows.length === 0)
    return { error: "No rows to import." };

  const rowErrors: RowError[] = [];
  for (let i = 0; i < rows.length; i++) {
    const m = mapRow(rows[i], SUBMISSION_ALIASES);
    const rowNum = i + 2;
    if (!m.candidate) {
      rowErrors.push({ row: rowNum, field: "Candidate Name", issue: "Required field is missing" });
      continue;
    }
    const checks = [
      validateNumeric(m.rate, "Rate", rowNum),
      validateDateField(m.submitted_date, "Submission Date", rowNum),
    ];
    checks.forEach((e) => e && rowErrors.push(e));
  }
  if (rowErrors.length > 0) return { error: "Validation failed", rowErrors };

  const supabase = await createClient();
  const { data: cands } = await supabase.from("candidates").select("id, full_name");
  const { data: vends } = await supabase.from("vendors").select("id, name");
  const { data: existingSubs } = await supabase
    .from("submissions")
    .select("candidate_id, vendor_id, submitted_date");

  const candByName = new Map(
    (cands ?? []).map((c) => [c.full_name.toLowerCase().trim(), c.id as string]),
  );
  const vendByName = new Map(
    (vends ?? []).map((v) => [v.name.toLowerCase().trim(), v.id as string]),
  );
  const subKeys = new Set(
    (existingSubs ?? []).map((s) => `${s.candidate_id}|${s.vendor_id ?? ""}|${s.submitted_date ?? ""}`),
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
    const m = mapRow(row, SUBMISSION_ALIASES);
    if (!m.candidate) { skipped++; continue; }
    const candidate_id = await resolveCandidate(m.candidate);
    if (!candidate_id) { skipped++; continue; }
    const vendor_id = m.vendor ? await resolveVendor(m.vendor) : null;
    const submittedDate = parseDate(m.submitted_date);
    const dupKey = `${candidate_id}|${vendor_id ?? ""}|${submittedDate ?? ""}`;
    if (subKeys.has(dupKey)) { duplicates++; continue; }
    subKeys.add(dupKey);
    toInsert.push({
      candidate_id,
      vendor_id,
      end_client: m.end_client ?? null,
      prime_layer: normPrimeLayer(m.prime_layer),
      rate: parseNumber(m.rate),
      submitted_date: submittedDate ?? undefined,
      status: normStatus(m.status),
      created_by: me.id,
    });
  }

  if (toInsert.length === 0)
    return { error: "No new rows — all entries already exist or were invalid.", rowErrors: [] };

  const { error } = await supabase.from("submissions").insert(toInsert);
  if (error) return { error: error.message };
  revalidatePath("/submissions");
  return { ok: true as const, inserted: toInsert.length, skipped, duplicates };
}

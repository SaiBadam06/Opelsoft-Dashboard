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
import {
  syncCandidateStage,
  ensurePlacementFromSubmission,
} from "@/lib/pipeline-sync.server";

function normStatus(v: string | undefined): SubmissionStatus {
  const s = (v ?? "").toLowerCase();
  if (s.includes("match")) return "matched";
  if (s.includes("rtr") && s.includes("receiv")) return "rtr_received";
  if (s.includes("rtr")) return "rtr_requested";
  if (s.includes("interview") && s.includes("request")) return "interview_requested";
  if (s.includes("interview")) return "interview_scheduled";
  if (s.includes("client") || s.includes("review") || s.includes("view"))
    return "client_review";
  if (s.includes("select") || s.includes("offer")) return "selected";
  if (s.includes("reject")) return "rejected";
  if (s.includes("hold")) return "on_hold";
  if (s.includes("plac")) return "placed";
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
  // Consistency with createSubmission: imported submissions must advance the
  // candidate's pipeline stage and create a placement for any `placed` row.
  // Sequential on purpose (not Promise.all): ensurePlacement's "no active
  // placement" guard would race if two `placed` rows for the same candidate ran
  // at once. Import is an occasional admin action, so O(n) round-trips is fine.
  const affected = new Set(toInsert.map((r) => r.candidate_id));
  for (const cid of affected) await syncCandidateStage(supabase, cid, me.id);
  for (const r of toInsert) await ensurePlacementFromSubmission(supabase, r, me.id);
  revalidatePath("/submissions");
  revalidatePath("/pipeline");
  revalidatePath("/candidates");
  revalidatePath("/placements");
  revalidatePath("/dashboard");
  return { ok: true as const, inserted: toInsert.length, skipped, duplicates };
}

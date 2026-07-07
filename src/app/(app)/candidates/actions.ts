"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { DOCUMENT_BUCKET, DOCUMENT_TYPES } from "@/lib/documents";
import type { CandidateStatus, PipelineStage } from "@/lib/candidate-constants";

function str(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v === "" ? null : v;
}

function num(formData: FormData, key: string): number | null {
  const v = str(formData, key);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildPayload(formData: FormData) {
  return {
    full_name: String(formData.get("full_name") ?? "").trim(),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    location: str(formData, "location"),
    experience_years: num(formData, "experience_years"),
    current_company: str(formData, "current_company"),
    rate: num(formData, "rate"),
    visa: str(formData, "visa"),
    relocation: str(formData, "relocation"),
    availability: str(formData, "availability"),
    linkedin: str(formData, "linkedin"),
    github: str(formData, "github"),
    portfolio: str(formData, "portfolio"),
    primary_skills: str(formData, "primary_skills"),
    secondary_skills: str(formData, "secondary_skills"),
    certifications: str(formData, "certifications"),
    projects: str(formData, "projects"),
    education: str(formData, "education"),
    preferred_location: str(formData, "preferred_location"),
    status: (str(formData, "status") ?? "available") as CandidateStatus,
    pipeline_stage: (str(formData, "pipeline_stage") ?? "new") as PipelineStage,
    visa_transfer: ["on", "true", "1"].includes(
      String(formData.get("visa_transfer") ?? "").toLowerCase(),
    ),
    notes: str(formData, "notes"),
  };
}

// Uploads any documents attached in the create form and records them. The
// resume row carries its parsed JSON; other doc types stay null. Fail-soft:
// a bad file never blocks candidate creation.
async function saveCandidateDocs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  candidateId: string,
  uploaderId: string,
) {
  const resumeParsedRaw = String(formData.get("resume_parsed") ?? "");
  for (const d of DOCUMENT_TYPES) {
    const files = formData
      .getAll(`doc_${d.value}`)
      .filter((v): v is File => v instanceof File && v.size > 0);
    for (const file of files) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${candidateId}/${Date.now()}-${safe}`;
      const up = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .upload(path, file);
      if (up.error) continue;
      await supabase.from("documents").insert({
        candidate_id: candidateId,
        type: d.value,
        file_name: file.name,
        storage_path: path,
        size_bytes: file.size,
        uploaded_by: uploaderId,
        parsed_data:
          d.value === "resume" && resumeParsedRaw
            ? JSON.parse(resumeParsedRaw)
            : null,
      });
    }
  }
}

export async function createCandidate(_prev: unknown, formData: FormData) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };

  const payload = buildPayload(formData);
  if (!payload.full_name) return { error: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("candidates")
    .insert({
      ...payload,
      assigned_coordinator_id: me.id,
      created_by: me.id,
      updated_by: me.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  await saveCandidateDocs(supabase, formData, data.id, me.id);
  revalidatePath("/candidates");
  revalidatePath("/pipeline");
  redirect(`/candidates/${data.id}`);
}

export async function updateCandidate(
  _prev: unknown,
  formData: FormData,
) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing candidate id." };

  const payload = buildPayload(formData);
  if (!payload.full_name) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("candidates")
    .update({ ...payload, updated_by: me.id })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/candidates");
  revalidatePath(`/candidates/${id}`);
  revalidatePath("/pipeline");
  redirect(`/candidates/${id}`);
}

export async function deleteCandidate(id: string) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const supabase = await createClient();
  const { error } = await supabase.from("candidates").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/candidates");
  revalidatePath("/pipeline");
  redirect("/candidates");
}

export async function setStatus(id: string, status: CandidateStatus) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("candidates")
    .update({ status, updated_by: me.id })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/candidates");
  revalidatePath("/pipeline");
  revalidatePath(`/candidates/${id}`);
  return { ok: true as const };
}

export async function setStage(id: string, stage: PipelineStage) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("candidates")
    .update({ pipeline_stage: stage, updated_by: me.id })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/pipeline");
  revalidatePath("/candidates");
  revalidatePath(`/candidates/${id}`);
  return { ok: true as const };
}

export async function reassignCandidate(id: string, coordinatorId: string) {
  const me = await getCurrentProfile();
  if (me?.role !== "admin") return { error: "Only admins can reassign." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("candidates")
    .update({ assigned_coordinator_id: coordinatorId, updated_by: me.id })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/candidates");
  revalidatePath(`/candidates/${id}`);
  return { ok: true as const };
}

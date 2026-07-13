"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  writeBackStageToSubmission,
  candidateHasActivity,
} from "@/lib/pipeline-sync.server";
import { stageRequiresBacking } from "@/lib/pipeline-sync";
import { stageLabel } from "@/lib/candidate-constants";
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

// Create variant that returns the new id (no redirect) so the client autofill
// flow can then upload the resume + save its parse under the new candidate.
export async function createCandidateReturningId(
  formData: FormData,
): Promise<{ id: string } | { error: string }> {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };

  const payload = buildPayload(formData);
  if (!payload.full_name) return { error: "Name is required." };
  // A brand-new candidate has no submissions/interviews yet.
  if (stageRequiresBacking(payload.pipeline_stage)) {
    return {
      error: `Can't create a candidate at ${stageLabel(payload.pipeline_stage)} — add a submission or interview first.`,
    };
  }

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
  revalidatePath("/candidates");
  revalidatePath("/pipeline");
  return { id: data.id as string };
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
  const { data: before } = await supabase
    .from("candidates")
    .select("pipeline_stage")
    .eq("id", id)
    .single();
  if (
    stageRequiresBacking(payload.pipeline_stage) &&
    !(await candidateHasActivity(supabase, id))
  ) {
    return {
      error: `Can't set stage to ${stageLabel(payload.pipeline_stage)} — this candidate has no submission or interview yet.`,
    };
  }
  const { error } = await supabase
    .from("candidates")
    .update({ ...payload, updated_by: me.id })
    .eq("id", id);

  if (error) return { error: error.message };
  // Parity with the pipeline drag (setStage): an edit that changes the stage
  // writes back to the candidate's latest submission (and placement if placed).
  if (before && before.pipeline_stage !== payload.pipeline_stage) {
    await writeBackStageToSubmission(supabase, id, payload.pipeline_stage, me.id);
  }
  revalidatePath("/candidates");
  revalidatePath(`/candidates/${id}`);
  revalidatePath("/pipeline");
  revalidatePath("/submissions");
  revalidatePath("/placements");
  revalidatePath("/dashboard");
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
  if (stageRequiresBacking(stage) && !(await candidateHasActivity(supabase, id))) {
    return {
      error: `Can't move to ${stageLabel(stage)} — this candidate has no submission or interview yet.`,
    };
  }
  const { error } = await supabase
    .from("candidates")
    .update({ pipeline_stage: stage, updated_by: me.id })
    .eq("id", id);
  if (error) return { error: error.message };
  // Step 5: reverse sync — a drag also updates the candidate's latest submission.
  await writeBackStageToSubmission(supabase, id, stage, me.id);
  revalidatePath("/pipeline");
  revalidatePath("/candidates");
  revalidatePath(`/candidates/${id}`);
  revalidatePath("/submissions");
  revalidatePath("/dashboard");
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

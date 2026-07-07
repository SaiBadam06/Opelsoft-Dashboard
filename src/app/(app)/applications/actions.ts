"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import type { JobApplicationStatus } from "@/lib/career-constants";
import {
  APPLICATION_RESUME_BUCKET,
  getApplication,
} from "@/lib/job-applications";
import { DOCUMENT_BUCKET } from "@/lib/documents";

const VALID_STATUSES: JobApplicationStatus[] = [
  "new",
  "reviewing",
  "shortlisted",
  "rejected",
  "converted",
];

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function applicationNotes(app: Awaited<ReturnType<typeof getApplication>>) {
  if (!app) return "";
  return [
    app.cover_note ? `Cover note:\n${app.cover_note}` : null,
    `Converted from careers application (${app.id}).`,
    app.source ? `Source: ${app.source}` : null,
    app.site_name ? `Career site: ${app.site_name}` : null,
    app.job_title ? `Applied for: ${app.job_title}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function copyResumeToCandidate(
  app: NonNullable<Awaited<ReturnType<typeof getApplication>>>,
  candidateId: string,
  uploadedBy: string,
): Promise<{ error?: string }> {
  if (!app.resume_path) return {};

  const supabase = await createClient();
  const admin = adminClient();
  const { data: blob, error: downloadError } = await admin.storage
    .from(APPLICATION_RESUME_BUCKET)
    .download(app.resume_path);
  if (downloadError) {
    return { error: `Resume copy failed: ${downloadError.message}` };
  }

  const fileName = app.resume_path.split("/").pop() ?? "resume.pdf";
  const destPath = `${candidateId}/${Date.now()}-${fileName}`;
  const { error: uploadError } = await admin.storage
    .from(DOCUMENT_BUCKET)
    .upload(destPath, blob, { upsert: false });
  if (uploadError) {
    return { error: `Resume upload failed: ${uploadError.message}` };
  }

  const { error: docError } = await supabase.from("documents").insert({
    candidate_id: candidateId,
    type: "resume",
    file_name: fileName,
    storage_path: destPath,
    size_bytes: blob.size,
    uploaded_by: uploadedBy,
  });
  if (docError) {
    return { error: `Document record failed: ${docError.message}` };
  }

  return {};
}

export async function setApplicationStatus(
  id: string,
  status: JobApplicationStatus,
) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  if (!VALID_STATUSES.includes(status)) return { error: "Invalid status." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("job_applications")
    .update({ status })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/applications");
  revalidatePath(`/applications/${id}`);
  return { ok: true as const };
}

export async function getApplicationResumeUrl(storagePath: string) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  if (!storagePath) return { error: "No resume on file." };

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(APPLICATION_RESUME_BUCKET)
    .createSignedUrl(storagePath, 60 * 10);
  if (error || !data) return { error: error?.message ?? "Could not sign URL" };
  return { ok: true as const, url: data.signedUrl };
}

export async function findCandidateForApplication(
  email: string,
  candidateId?: string | null,
) {
  if (candidateId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("candidates")
      .select("id, full_name")
      .eq("id", candidateId)
      .maybeSingle();
    if (data) return data;
  }

  const supabase = await createClient();
  const normalized = email.trim().toLowerCase();
  const { data } = await supabase
    .from("candidates")
    .select("id, full_name")
    .ilike("email", normalized)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function convertApplicationToCandidate(applicationId: string) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };

  const app = await getApplication(applicationId);
  if (!app) return { error: "Application not found." };
  if (app.status === "converted") {
    return { error: "This application was already converted." };
  }

  const supabase = await createClient();
  const notes = applicationNotes(app);
  const normalizedEmail = app.email.trim().toLowerCase();

  const existing = await findCandidateForApplication(
    normalizedEmail,
    app.candidate_id,
  );

  let candidateId: string;

  if (existing) {
    candidateId = existing.id;
    const { data: row } = await supabase
      .from("candidates")
      .select("notes")
      .eq("id", candidateId)
      .single();
    const mergedNotes = [row?.notes, notes].filter(Boolean).join("\n\n---\n\n");
    const { error: updateError } = await supabase
      .from("candidates")
      .update({
        phone: app.phone ?? undefined,
        location: app.location ?? undefined,
        linkedin: app.linkedin_url ?? undefined,
        portfolio: app.portfolio_url ?? undefined,
        notes: mergedNotes,
        updated_by: me.id,
      })
      .eq("id", candidateId);
    if (updateError) return { error: updateError.message };
  } else {
    const { data: candidate, error: insertError } = await supabase
      .from("candidates")
      .insert({
        full_name: app.candidate_name,
        email: normalizedEmail,
        phone: app.phone,
        location: app.location,
        linkedin: app.linkedin_url,
        portfolio: app.portfolio_url,
        notes,
        status: "available",
        pipeline_stage: "new",
        assigned_coordinator_id: me.id,
        created_by: me.id,
        updated_by: me.id,
      })
      .select("id")
      .single();
    if (insertError) return { error: insertError.message };
    candidateId = candidate.id;

    const resumeResult = await copyResumeToCandidate(app, candidateId, me.id);
    if (resumeResult.error) {
      return {
        error: `Candidate created but ${resumeResult.error}`,
        candidateId,
      };
    }
  }

  if (existing && app.resume_path) {
    const resumeResult = await copyResumeToCandidate(app, candidateId, me.id);
    if (resumeResult.error) {
      return {
        error: `Linked to existing candidate but ${resumeResult.error}`,
        candidateId,
      };
    }
  }

  const { error: statusError } = await supabase
    .from("job_applications")
    .update({ status: "converted", candidate_id: candidateId })
    .eq("id", applicationId);
  if (statusError) return { error: statusError.message };

  revalidatePath("/applications");
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/candidates");
  revalidatePath(`/candidates/${candidateId}`);
  redirect(`/candidates/${candidateId}`);
}

/** @deprecated Use Submissions → New submission after recruiter follow-up. */
export async function createSubmissionFromApplication(applicationId: string) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };

  const app = await getApplication(applicationId);
  if (!app) return { error: "Application not found." };
  if (!app.requirement_id) {
    return {
      error:
        "This job posting is not linked to an internal requirement. Link it on the requirement detail page first.",
    };
  }

  const candidate = await findCandidateForApplication(
    app.email,
    app.candidate_id,
  );
  if (!candidate) {
    return {
      error:
        "No candidate found for this applicant. Convert the application to a candidate first.",
    };
  }

  redirect(
    `/submissions/new?candidate_id=${encodeURIComponent(candidate.id)}&requirement_id=${encodeURIComponent(app.requirement_id)}`,
  );
}

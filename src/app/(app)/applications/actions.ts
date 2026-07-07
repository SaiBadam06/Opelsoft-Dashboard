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

export async function convertApplicationToCandidate(applicationId: string) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };

  const app = await getApplication(applicationId);
  if (!app) return { error: "Application not found." };
  if (app.status === "converted") {
    return { error: "This application was already converted." };
  }

  const supabase = await createClient();
  const notes = [
    app.cover_note ? `Cover note:\n${app.cover_note}` : null,
    `Converted from careers application (${applicationId}).`,
    app.source ? `Source: ${app.source}` : null,
    app.site_name ? `Career site: ${app.site_name}` : null,
    app.job_title ? `Applied for: ${app.job_title}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { data: candidate, error: insertError } = await supabase
    .from("candidates")
    .insert({
      full_name: app.candidate_name,
      email: app.email,
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

  if (app.resume_path) {
    const admin = adminClient();
    const { data: blob, error: downloadError } = await admin.storage
      .from(APPLICATION_RESUME_BUCKET)
      .download(app.resume_path);
    if (downloadError) {
      return {
        error: `Candidate created but resume copy failed: ${downloadError.message}`,
        candidateId: candidate.id,
      };
    }

    const fileName = app.resume_path.split("/").pop() ?? "resume.pdf";
    const destPath = `${candidate.id}/${Date.now()}-${fileName}`;
    const { error: uploadError } = await admin.storage
      .from(DOCUMENT_BUCKET)
      .upload(destPath, blob, { upsert: false });
    if (uploadError) {
      return {
        error: `Candidate created but resume upload failed: ${uploadError.message}`,
        candidateId: candidate.id,
      };
    }

    const { error: docError } = await supabase.from("documents").insert({
      candidate_id: candidate.id,
      type: "resume",
      file_name: fileName,
      storage_path: destPath,
      size_bytes: blob.size,
      uploaded_by: me.id,
    });
    if (docError) {
      return {
        error: `Candidate created but document record failed: ${docError.message}`,
        candidateId: candidate.id,
      };
    }
  }

  const { error: statusError } = await supabase
    .from("job_applications")
    .update({ status: "converted" })
    .eq("id", applicationId);
  if (statusError) return { error: statusError.message };

  revalidatePath("/applications");
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/candidates");
  revalidatePath(`/candidates/${candidate.id}`);
  redirect(`/candidates/${candidate.id}`);
}

export async function findCandidateForApplication(email: string) {
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

  const candidate = await findCandidateForApplication(app.email);
  if (!candidate) {
    return {
      error:
        "No candidate found for this applicant. Convert the application to a candidate first.",
    };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("submissions")
    .select("id")
    .eq("candidate_id", candidate.id)
    .eq("requirement_id", app.requirement_id)
    .maybeSingle();
  if (existing) {
    return {
      error: "A submission already exists for this candidate and requirement.",
      submissionId: existing.id,
    };
  }

  const notes = [
    `Created from careers application (${applicationId}).`,
    app.job_title ? `Applied for: ${app.job_title}` : null,
    app.site_name ? `Career site: ${app.site_name}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const today = new Date().toISOString().slice(0, 10);
  const { data: submission, error } = await supabase
    .from("submissions")
    .insert({
      candidate_id: candidate.id,
      requirement_id: app.requirement_id,
      submitted_date: today,
      status: "matched",
      notes,
      created_by: me.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/applications");
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/submissions");
  revalidatePath(`/submissions/${submission.id}`);
  revalidatePath("/logs");
  redirect("/submissions");
}

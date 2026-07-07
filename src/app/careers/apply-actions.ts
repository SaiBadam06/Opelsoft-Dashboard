"use server";

import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  APPLICATION_RESUME_BUCKET,
  APPLY_ALLOWED_TYPES,
  APPLY_MAX_RESUME_BYTES,
} from "@/lib/job-applications";
import { resolveCareerSite } from "@/lib/career-sites";
import { withCareersSiteQuery } from "@/lib/career-urls";
import { getPublicJob } from "@/lib/job-postings";

function str(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
}

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function applyToJob(_prev: unknown, fd: FormData) {
  const honeypot = str(fd, "company_website");
  if (honeypot) {
    const site = await resolveCareerSite();
    redirect(site ? withCareersSiteQuery("/careers", site) : "/careers");
  }

  const jobSlug = String(fd.get("job_slug") ?? "").trim();
  const name = String(fd.get("candidate_name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const phone = str(fd, "phone");
  const location = str(fd, "location");
  const linkedinUrl = str(fd, "linkedin_url");
  const portfolioUrl = str(fd, "portfolio_url");
  const coverNote = str(fd, "cover_note");
  const resume = fd.get("resume");

  if (!jobSlug) return { error: "Job not found." };
  if (!name) return { error: "Name is required." };
  if (!email || !email.includes("@")) return { error: "Valid email is required." };
  if (!(resume instanceof File) || resume.size === 0) {
    return { error: "Resume is required." };
  }
  if (resume.size > APPLY_MAX_RESUME_BYTES) {
    return { error: "Resume must be 5 MB or smaller." };
  }
  if (
    !APPLY_ALLOWED_TYPES.includes(
      resume.type as (typeof APPLY_ALLOWED_TYPES)[number],
    )
  ) {
    return { error: "Resume must be PDF or Word (.doc, .docx)." };
  }

  const site = await resolveCareerSite();
  if (!site) return { error: "Careers site not configured." };

  const job = await getPublicJob(site.id, jobSlug);
  if (!job) return { error: "This job is no longer accepting applications." };

  const admin = adminClient();
  const safeName = resume.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${job.id}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await admin.storage
    .from(APPLICATION_RESUME_BUCKET)
    .upload(storagePath, resume, { contentType: resume.type, upsert: false });
  if (uploadError) return { error: uploadError.message };

  const { data: distribution } = await admin
    .from("posting_distributions")
    .select("id")
    .eq("job_posting_id", job.id)
    .eq("career_site_id", site.id)
    .eq("is_active", true)
    .maybeSingle();

  const { error: insertError } = await admin.from("job_applications").insert({
    job_posting_id: job.id,
    distribution_id: distribution?.id ?? null,
    source: "careers_site",
    candidate_name: name,
    email,
    phone,
    location,
    linkedin_url: linkedinUrl,
    portfolio_url: portfolioUrl,
    resume_path: storagePath,
    cover_note: coverNote,
    status: "new",
  });
  if (insertError) {
    await admin.storage.from(APPLICATION_RESUME_BUCKET).remove([storagePath]);
    return { error: insertError.message };
  }

  redirect(
    withCareersSiteQuery(`/careers/jobs/${jobSlug}/apply/thank-you`, site),
  );
}

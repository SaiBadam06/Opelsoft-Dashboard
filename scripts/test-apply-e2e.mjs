/**
 * E2E smoke test: careers apply → job_applications row.
 * Usage: dotenv -e .env.local -- node scripts/test-apply-e2e.mjs
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BUCKET = "application-resumes";
const JOB_SLUG = "senior-java-developer";
const TEST_EMAIL = `e2e-apply-${Date.now()}@example.com`;
const TEST_NAME = "E2E Test Applicant";

// Minimal valid PDF
const RESUME_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
);

async function main() {
  const { data: site } = await admin
    .from("career_sites")
    .select("id, slug")
    .eq("slug", "opelsoft")
    .single();
  if (!site) {
    console.error("FAIL: opelsoft career site not found");
    process.exit(1);
  }

  const { data: job } = await admin
    .from("job_postings")
    .select("id, title, status")
    .eq("public_slug", JOB_SLUG)
    .maybeSingle();
  if (!job || job.status !== "published") {
    console.error("FAIL: published job not found for slug", JOB_SLUG);
    process.exit(1);
  }

  const { data: distribution } = await admin
    .from("posting_distributions")
    .select("id")
    .eq("job_posting_id", job.id)
    .eq("career_site_id", site.id)
    .eq("is_active", true)
    .maybeSingle();

  const storagePath = `${job.id}/${Date.now()}-e2e-resume.pdf`;
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, RESUME_BYTES, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (uploadError) {
    console.error("FAIL: resume upload:", uploadError.message);
    process.exit(1);
  }

  const { data: inserted, error: insertError } = await admin
    .from("job_applications")
    .insert({
      job_posting_id: job.id,
      distribution_id: distribution?.id ?? null,
      source: "careers_site",
      candidate_name: TEST_NAME,
      email: TEST_EMAIL,
      phone: "555-0100",
      location: "Remote",
      resume_path: storagePath,
      cover_note: "E2E test application",
      status: "new",
    })
    .select("id, candidate_name, email, status, created_at")
    .single();

  if (insertError) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    console.error("FAIL: insert job_applications:", insertError.message);
    process.exit(1);
  }

  const { data: verify } = await admin
    .from("job_applications")
    .select("id, email")
    .eq("email", TEST_EMAIL)
    .maybeSingle();

  if (!verify?.id) {
    console.error("FAIL: row not found after insert");
    process.exit(1);
  }

  console.log("PASS: apply E2E");
  console.log("  application_id:", inserted.id);
  console.log("  email:", TEST_EMAIL);
  console.log("  job:", job.title);
  console.log("  resume:", storagePath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

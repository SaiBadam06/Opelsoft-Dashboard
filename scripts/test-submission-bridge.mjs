/**
 * E2E smoke test: application → candidate → submission bridge (Phase 6 / M4).
 * Mirrors createSubmissionFromApplication data prerequisites and insert.
 * Usage: dotenv -e .env.local -- node scripts/test-submission-bridge.mjs
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

const JOB_SLUG = "senior-java-developer";
const TEST_EMAIL = `e2e-bridge-${Date.now()}@example.com`;
const TEST_NAME = "E2E Bridge Applicant";

async function main() {
  const { data: job, error: jobError } = await admin
    .from("job_postings")
    .select("id, title, requirement_id")
    .eq("public_slug", JOB_SLUG)
    .maybeSingle();
  if (jobError || !job) {
    console.error("FAIL: job posting not found:", jobError?.message);
    process.exit(1);
  }

  let requirementId = job.requirement_id;
  if (!requirementId) {
    const { data: req } = await admin
      .from("requirements")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!req) {
      console.error(
        "FAIL: no requirement to link — seed requirements first (npm run seed:all)",
      );
      process.exit(1);
    }
    const { error: linkError } = await admin
      .from("job_postings")
      .update({ requirement_id: req.id })
      .eq("id", job.id);
    if (linkError) {
      console.error("FAIL: link requirement:", linkError.message);
      process.exit(1);
    }
    requirementId = req.id;
    console.log("Linked job posting to requirement:", requirementId);
  }

  const { data: app, error: appError } = await admin
    .from("job_applications")
    .insert({
      job_posting_id: job.id,
      source: "careers_site",
      candidate_name: TEST_NAME,
      email: TEST_EMAIL,
      status: "converted",
    })
    .select("id")
    .single();
  if (appError) {
    console.error("FAIL: insert application:", appError.message);
    process.exit(1);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (!profile) {
    console.error("FAIL: no profile for created_by");
    process.exit(1);
  }

  const { data: candidate, error: candError } = await admin
    .from("candidates")
    .insert({
      full_name: TEST_NAME,
      email: TEST_EMAIL,
      status: "available",
      pipeline_stage: "new",
      assigned_coordinator_id: profile.id,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id")
    .single();
  if (candError) {
    console.error("FAIL: insert candidate:", candError.message);
    process.exit(1);
  }

  const { data: existing } = await admin
    .from("submissions")
    .select("id")
    .eq("candidate_id", candidate.id)
    .eq("requirement_id", requirementId)
    .maybeSingle();
  if (existing) {
    console.error("FAIL: unexpected existing submission");
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);
  const notes = `Created from careers application (${app.id}).\nApplied for: ${job.title}`;
  const { data: submission, error: subError } = await admin
    .from("submissions")
    .insert({
      candidate_id: candidate.id,
      requirement_id: requirementId,
      submitted_date: today,
      status: "matched",
      notes,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (subError) {
    console.error("FAIL: insert submission:", subError.message);
    process.exit(1);
  }

  const { data: verify } = await admin
    .from("submissions")
    .select("id, candidate_id, requirement_id, status")
    .eq("id", submission.id)
    .maybeSingle();
  if (!verify?.id) {
    console.error("FAIL: submission not found after insert");
    process.exit(1);
  }

  console.log("PASS: submission bridge E2E");
  console.log("  application_id:", app.id);
  console.log("  candidate_id:", candidate.id);
  console.log("  submission_id:", submission.id);
  console.log("  requirement_id:", requirementId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Seed one published demo job on the Opelsoft careers site (Sprint A / M1).
 * Requires migration 0008 applied and at least one requirement row optional.
 *
 * Usage: npm run seed:careers-demo
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { data: site } = await supabase
    .from("career_sites")
    .select("id")
    .eq("slug", "opelsoft")
    .single();

  if (!site) {
    console.error("Opelsoft career site not found — run migration 0008 first");
    process.exit(1);
  }

  const { data: channel } = await supabase
    .from("distribution_channels")
    .select("id")
    .eq("slug", "careers_site")
    .single();

  if (!channel) {
    console.error("careers_site channel not found");
    process.exit(1);
  }

  const slug = "senior-java-developer";

  const { data: existing } = await supabase
    .from("job_postings")
    .select("id")
    .eq("public_slug", slug)
    .maybeSingle();

  let postingId = existing?.id;

  if (!postingId) {
    const { data: posting, error } = await supabase
      .from("job_postings")
      .insert({
        public_slug: slug,
        title: "Senior Java Developer",
        location: "Remote, US",
        workplace_type: "remote",
        employment_type: "C2C",
        skills: "Java, Spring Boot, AWS, Kubernetes",
        description: `- Design and build scalable microservices
- Lead code reviews and mentor junior developers
- Collaborate with product and client teams
- 8+ years of Java experience required`,
        status: "published",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create posting:", error.message);
      process.exit(1);
    }
    postingId = posting.id;
    console.log("Created job posting:", postingId);
  } else {
    await supabase
      .from("job_postings")
      .update({ status: "published" })
      .eq("id", postingId);
    console.log("Using existing posting:", postingId);
  }

  const { data: dist } = await supabase
    .from("posting_distributions")
    .select("id")
    .eq("job_posting_id", postingId)
    .eq("career_site_id", site.id)
    .maybeSingle();

  if (!dist) {
    const { error } = await supabase.from("posting_distributions").insert({
      job_posting_id: postingId,
      distribution_channel_id: channel.id,
      career_site_id: site.id,
      is_active: true,
      published_at: new Date().toISOString(),
    });
    if (error) {
      console.error("Failed to create distribution:", error.message);
      process.exit(1);
    }
    console.log("Created distribution for Opelsoft careers site");
  } else {
    console.log("Distribution already exists");
  }

  console.log("\n✓ Demo job ready at http://localhost:3000/careers/jobs/" + slug);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

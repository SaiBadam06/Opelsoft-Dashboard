/**
 * Quick brand QA: verify ?site= slugs resolve to expected career_sites rows.
 * Usage: dotenv -e .env.local -- node scripts/test-career-branding.mjs
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

const EXPECTED = {
  futurestack: {
    name: "Futurestack",
    hero_headline: "Careers at Futurestack",
    primary_color: "#7c3aed",
  },
  talent2meet: {
    name: "Talent2Meet",
    hero_headline: "Careers at Talent2Meet",
    primary_color: "#059669",
  },
};

async function main() {
  let failed = false;

  for (const [slug, exp] of Object.entries(EXPECTED)) {
    const { data: site, error } = await admin
      .from("career_sites")
      .select("slug, name, hero_headline, hero_subtext, primary_color, is_active")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !site) {
      console.error(`FAIL: ${slug} — not found`, error?.message);
      failed = true;
      continue;
    }
    if (!site.is_active) {
      console.error(`FAIL: ${slug} — site inactive`);
      failed = true;
      continue;
    }

    const mismatches = [];
    if (site.name !== exp.name) mismatches.push(`name: ${site.name} != ${exp.name}`);
    if (site.hero_headline !== exp.hero_headline) {
      mismatches.push(`headline: ${site.hero_headline} != ${exp.hero_headline}`);
    }
    if (site.primary_color !== exp.primary_color) {
      mismatches.push(`color: ${site.primary_color} != ${exp.primary_color}`);
    }

    if (mismatches.length) {
      console.error(`FAIL: ${slug} —`, mismatches.join("; "));
      failed = true;
    } else {
      console.log(`PASS: ${slug} — ${site.name}, ${site.primary_color}`);
    }
  }

  if (failed) process.exit(1);
  console.log("\nPASS: career site branding data OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminEmail = process.env.SEED_ADMIN_EMAIL!;

if (!url || !serviceKey || !adminEmail) {
  throw new Error("Missing env: SUPABASE URL/SERVICE_ROLE/SEED_ADMIN_EMAIL");
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SAMPLES = [
  {
    full_name: "RaviKrishna Thigulla",
    primary_skills: "Data Engineering",
    experience_years: 9,
    location: "OH",
    relocation: "Yes",
    visa: "H1B",
    rate: 60,
    phone: "(945) 270-2864",
    email: "ravikrishna.t96@example.com",
    status: "available",
    pipeline_stage: "new",
  },
  {
    full_name: "Vijetha Tummala",
    primary_skills: "Data Engineer",
    experience_years: 14,
    location: "DL/TX",
    relocation: "Remote",
    visa: "H1B",
    rate: 70,
    phone: "513-658-8659",
    email: "tummalavijetha@example.com",
    status: "submitted",
    pipeline_stage: "submitted",
  },
  {
    full_name: "Shivani",
    primary_skills: "Business Analyst / Data Analyst",
    experience_years: 8,
    location: "NJ",
    relocation: "Yes",
    visa: "H1B",
    rate: 60,
    phone: "201 589 9777",
    email: "shivani2995@example.com",
    status: "interviewing",
    pipeline_stage: "interview_r1",
  },
  {
    full_name: "Rohith Avatapally",
    primary_skills: "Java Developer",
    experience_years: 15,
    location: "CA",
    relocation: "CA or Remote",
    visa: "H1B",
    rate: 70,
    phone: "857-472-1889",
    email: "rohithavatapally@example.com",
    status: "interviewing",
    pipeline_stage: "interview_r2",
  },
  {
    full_name: "Mahith",
    primary_skills: "Salesforce Developer",
    experience_years: 11,
    location: "NJ",
    relocation: "Yes",
    visa: "H1B",
    rate: 60,
    phone: "551 655 1628",
    email: "meeumavenkata@example.com",
    status: "available",
    pipeline_stage: "screening",
  },
  {
    full_name: "SaiLaxmi Thilluru",
    primary_skills: "Sr. Business Analyst / Scrum Master",
    experience_years: 15,
    location: "OR",
    relocation: "Remote",
    visa: "USC",
    rate: 65,
    phone: "407-272-5007",
    email: "saithulluru@example.com",
    status: "placed",
    pipeline_stage: "placed",
  },
];

async function main() {
  const { data: adminProfile, error: pErr } = await admin
    .from("profiles")
    .select("id")
    .eq("email", adminEmail)
    .single();
  if (pErr || !adminProfile) {
    throw new Error(`Could not find admin profile for ${adminEmail}: ${pErr?.message}`);
  }

  const rows = SAMPLES.map((s) => ({
    ...s,
    assigned_coordinator_id: adminProfile.id,
    created_by: adminProfile.id,
    updated_by: adminProfile.id,
  }));

  const { error } = await admin.from("candidates").insert(rows);
  if (error) throw error;

  console.log(`Seeded ${rows.length} sample candidates (assigned to ${adminEmail}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

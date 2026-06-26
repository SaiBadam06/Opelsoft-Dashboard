import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminEmail = process.env.SEED_ADMIN_EMAIL!;
if (!url || !serviceKey || !adminEmail) {
  throw new Error("Missing env: SUPABASE URL/SERVICE_ROLE/SEED_ADMIN_EMAIL");
}
const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CANDIDATES = [
  { full_name: "RaviKrishna Thigulla", primary_skills: "Data Engineering", experience_years: 9, location: "OH", visa: "H1B", rate: 60, status: "available", pipeline_stage: "new" },
  { full_name: "Vijetha Tummala", primary_skills: "Data Engineer", experience_years: 14, location: "TX", visa: "H1B", rate: 70, status: "submitted", pipeline_stage: "submitted" },
  { full_name: "Shivani", primary_skills: "Business Analyst", experience_years: 8, location: "NJ", visa: "H1B", rate: 60, status: "interviewing", pipeline_stage: "interview_r1" },
  { full_name: "Rohith Avatapally", primary_skills: "Java Developer", experience_years: 15, location: "CA", visa: "H1B", rate: 70, status: "interviewing", pipeline_stage: "interview_r2" },
  { full_name: "Mahith", primary_skills: "Salesforce Developer", experience_years: 11, location: "NJ", visa: "H1B", rate: 60, status: "available", pipeline_stage: "screening" },
  { full_name: "SaiLaxmi Thilluru", primary_skills: "Sr. Business Analyst / Scrum Master", experience_years: 15, location: "OR", visa: "USC", rate: 65, status: "placed", pipeline_stage: "placed" },
];

const VENDORS = [
  { name: "Univedge Consulting", contact_name: "Shubhranshu Arya", email: "shubhranshu.arya@univedge.example", phone: "(415) 555-0101" },
  { name: "VBeyond", contact_name: "Jayanth G", email: "jayanthg@vbeyond.example", phone: "(415) 555-0102" },
  { name: "TekPlant Inc", contact_name: "Prakhar Srivastava", email: "prakhar@tekplant.example", phone: "(415) 555-0103" },
  { name: "CloudIngest Inc", contact_name: "Riya M", email: "contact@cloudingest.example", phone: "(415) 555-0104" },
];

async function main() {
  const { data: admin } = await db.from("profiles").select("id").eq("email", adminEmail).single();
  if (!admin) throw new Error(`No admin profile for ${adminEmail}`);
  const adminId = admin.id as string;
  const stamp = { assigned_coordinator_id: adminId, created_by: adminId, updated_by: adminId };

  // Candidates (only if empty)
  const { count: candCount } = await db.from("candidates").select("*", { count: "exact", head: true });
  if (!candCount) {
    await db.from("candidates").insert(CANDIDATES.map((c) => ({ ...c, ...stamp })));
    console.log("seeded candidates");
  }
  const { data: cands } = await db.from("candidates").select("id, full_name");
  const cand = (name: string) => cands?.find((c) => c.full_name === name)?.id ?? cands?.[0]?.id;

  // Vendors
  const { count: vCount } = await db.from("vendors").select("*", { count: "exact", head: true });
  if (!vCount) await db.from("vendors").insert(VENDORS.map((v) => ({ ...v, created_by: adminId })));
  const { data: vendors } = await db.from("vendors").select("id, name");
  const vend = (name: string) => vendors?.find((v) => v.name === name)?.id ?? vendors?.[0]?.id;

  const { count: rCount } = await db.from("requirements").select("*", { count: "exact", head: true });
  if (!rCount) {
    await db.from("requirements").insert([
      { title: "Senior Data Engineer", vendor_id: vend("Univedge Consulting"), end_client: "Wipro / UHG", skills: "Python, Spark, Snowflake", location: "TX", remote: true, rate: 70, employment_type: "C2C", priority: "high", status: "open", experience: "12+ yrs", created_by: adminId },
      { title: "Java Full Stack Developer", vendor_id: vend("TekPlant Inc"), end_client: "Royal Caribbean", skills: "Java, Spring Boot, React", location: "CA", remote: false, rate: 65, employment_type: "C2C", priority: "urgent", status: "open", experience: "10+ yrs", created_by: adminId },
      { title: "Salesforce Developer", vendor_id: vend("VBeyond"), end_client: "Citius Tech", skills: "Apex, LWC", location: "NJ", remote: true, rate: 60, employment_type: "C2C", priority: "medium", status: "on_hold", experience: "8+ yrs", created_by: adminId },
      { title: "Business Analyst / Scrum Master", vendor_id: vend("CloudIngest Inc"), end_client: "Fiserv", skills: "Agile, JIRA", location: "Remote", remote: true, rate: 65, employment_type: "W2", priority: "low", status: "filled", experience: "15+ yrs", created_by: adminId },
    ]);
  }
  const { data: reqs } = await db.from("requirements").select("id, title");
  const req = (t: string) => reqs?.find((r) => r.title === t)?.id ?? null;

  const { count: sCount } = await db.from("submissions").select("*", { count: "exact", head: true });
  if (!sCount) {
    await db.from("submissions").insert([
      { candidate_id: cand("Vijetha Tummala"), requirement_id: req("Senior Data Engineer"), vendor_id: vend("Univedge Consulting"), end_client: "Wipro / UHG", prime_layer: "prime", rate: 70, status: "submitted", created_by: adminId },
      { candidate_id: cand("Rohith Avatapally"), requirement_id: req("Java Full Stack Developer"), vendor_id: vend("TekPlant Inc"), end_client: "Royal Caribbean", prime_layer: "layer", rate: 65, status: "interview_scheduled", created_by: adminId },
      { candidate_id: cand("Mahith"), requirement_id: req("Salesforce Developer"), vendor_id: vend("VBeyond"), end_client: "Citius Tech", prime_layer: "prime", rate: 60, status: "viewed", created_by: adminId },
    ]);
  }

  const { count: iCount } = await db.from("interviews").select("*", { count: "exact", head: true });
  if (!iCount) {
    const soon = new Date(Date.now() + 2 * 86400000).toISOString();
    await db.from("interviews").insert([
      { candidate_id: cand("Shivani"), requirement_id: req("Salesforce Developer"), end_client: "Citius Tech", round: "Round 1", interview_date: soon, mode: "Video", interviewer: "Hiring Manager", result: "scheduled", created_by: adminId },
      { candidate_id: cand("Rohith Avatapally"), requirement_id: req("Java Full Stack Developer"), end_client: "Royal Caribbean", round: "Round 2", interview_date: new Date().toISOString(), mode: "Onsite", interviewer: "Tech Panel", result: "pending", created_by: adminId },
    ]);
  }

  const { count: pCount } = await db.from("placements").select("*", { count: "exact", head: true });
  if (!pCount) {
    await db.from("placements").insert([
      { candidate_id: cand("SaiLaxmi Thilluru"), recruiter: "Bhanu", opt_recruiter: "Chaitanya", vendor_id: vend("CloudIngest Inc"), end_client: "Fiserv", new_exp: "Exp", rate: 65, placement_date: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10), in_out: "In", status: "active", feedback: "Delivered", created_by: adminId },
    ]);
  }

  const { count: tCount } = await db.from("tasks").select("*", { count: "exact", head: true });
  if (!tCount) {
    const due = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    await db.from("tasks").insert([
      { title: "Call RaviKrishna about new role", type: "call", candidate_id: cand("RaviKrishna Thigulla"), assigned_to: adminId, due_date: due, status: "pending", created_by: adminId },
      { title: "Collect updated resume from Mahith", type: "collect_documents", candidate_id: cand("Mahith"), assigned_to: adminId, due_date: due, status: "pending", created_by: adminId },
      { title: "Follow up with Vijetha submission", type: "follow_up", candidate_id: cand("Vijetha Tummala"), assigned_to: adminId, due_date: due, status: "done", created_by: adminId },
    ]);
  }

  console.log("Seed complete: vendors, requirements, submissions, interviews, placements, tasks.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

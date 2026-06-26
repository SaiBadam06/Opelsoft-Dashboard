// Header normalization + alias maps for spreadsheet import. Shared by the
// import server actions; no client-only deps so it stays server-safe.

export type RawRow = Record<string, unknown>;

export function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function parseNumber(v: unknown): number | null {
  if (v == null) return null;
  const m = String(v).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function parseDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// Build a {field: rawString} record from a raw row using header aliases.
export function mapRow(
  row: RawRow,
  aliases: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    const field = aliases[normHeader(key)];
    if (!field) continue;
    const v = value == null ? "" : String(value).trim();
    if (v !== "") out[field] = v;
  }
  return out;
}

export const CANDIDATE_ALIASES: Record<string, string> = {
  consultantname: "full_name",
  name: "full_name",
  fullname: "full_name",
  candidatename: "full_name",
  technology: "primary_skills",
  skills: "primary_skills",
  primaryskills: "primary_skills",
  skill: "primary_skills",
  yrsofexp: "experience_years",
  experience: "experience_years",
  yearsofexperience: "experience_years",
  exp: "experience_years",
  location: "location",
  currentlocation: "location",
  relocation: "relocation",
  visa: "visa",
  workauthorization: "visa",
  workauth: "visa",
  rate: "rate",
  billrate: "rate",
  contactnumber: "phone",
  phone: "phone",
  mobile: "phone",
  phonenumber: "phone",
  contact: "phone",
  emailid: "email",
  email: "email",
  mail: "email",
  comments: "notes",
  notes: "notes",
  remarks: "notes",
  currentcompany: "current_company",
  company: "current_company",
  availability: "availability",
};

export const PLACEMENT_ALIASES: Record<string, string> = {
  consultantname: "candidate",
  consultant: "candidate",
  candidatename: "candidate",
  name: "candidate",
  recruiter: "recruiter",
  optrecruiter: "opt_recruiter",
  vendor: "vendor",
  client: "end_client",
  endclient: "end_client",
  newexp: "new_exp",
  new: "new_exp",
  rate: "rate",
  placementdate: "placement_date",
  projectstartdate: "project_start_date",
  bgvanddate: "bgv_date",
  bgv: "bgv_date",
  bgvdate: "bgv_date",
  inout: "in_out",
  projectenddate: "project_end_date",
  feedback: "feedback",
};

export const SUBMISSION_ALIASES: Record<string, string> = {
  consultantname: "candidate",
  consultant: "candidate",
  candidatename: "candidate",
  name: "candidate",
  rate: "rate",
  vendor: "vendor",
  client: "end_client",
  endclient: "end_client",
  primelayer: "prime_layer",
  primeorlayer: "prime_layer",
  submissionstatus: "status",
  status: "status",
  date: "submitted_date",
  submissiondate: "submitted_date",
};

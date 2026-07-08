import type { RequirementPriority, RequirementStatus } from "@/lib/job-constants";

// Shape returned by the AI extractor. Every field is always present so the
// review form has a stable shape; missing data is null.
export interface ExtractedRequirement {
  title: string | null;
  location: string | null;
  end_client: string | null;
  vendor_name: string | null;
  rate: string | null;
  duration: string | null;
  work_mode: "remote" | "hybrid" | "onsite" | null;
  must_have_skills: string[] | null;
  nice_to_have_skills: string[] | null;
  work_authorization: string | null;
  submission_deadline: string | null; // YYYY-MM-DD
  contact_name: string | null;
  contact_email: string | null;
}

export interface VendorOption {
  id: string;
  name: string;
}

// Editable values shown in the review form (all strings — form inputs).
export interface IntakeFormValues {
  title: string;
  vendor_id: string; // "" if no match
  vendor_name: string; // extracted name, kept as a hint
  end_client: string;
  location: string;
  skills: string[];
  nice_to_have_skills: string[];
  work_authorization: string;
  duration: string;
  work_mode: string; // "" | remote | hybrid | onsite
  rate: string;
  closing_date: string;
  contact_name: string;
  contact_email: string;
  priority: RequirementPriority;
  status: RequirementStatus;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Case-insensitive match of an extracted vendor name to a known vendor.
// Exact-normalized first, then substring either direction. Null if no match.
export function matchVendorId(
  vendorName: string | null,
  vendors: VendorOption[],
): string | null {
  if (!vendorName) return null;
  const n = norm(vendorName);
  if (!n) return null;
  const exact = vendors.find((v) => norm(v.name) === n);
  if (exact) return exact.id;
  const partial = vendors.find((v) => {
    const vn = norm(v.name);
    return vn.includes(n) || n.includes(vn);
  });
  return partial?.id ?? null;
}

const s = (v: string | null) => v ?? "";

export function toFormValues(
  ex: ExtractedRequirement,
  vendors: VendorOption[],
): IntakeFormValues {
  return {
    title: s(ex.title),
    vendor_id: matchVendorId(ex.vendor_name, vendors) ?? "",
    vendor_name: s(ex.vendor_name),
    end_client: s(ex.end_client),
    location: s(ex.location),
    skills: ex.must_have_skills ?? [],
    nice_to_have_skills: ex.nice_to_have_skills ?? [],
    work_authorization: s(ex.work_authorization),
    duration: s(ex.duration),
    work_mode: s(ex.work_mode),
    rate: s(ex.rate),
    closing_date: s(ex.submission_deadline),
    contact_name: s(ex.contact_name),
    contact_email: s(ex.contact_email),
    priority: "medium",
    status: "open",
  };
}

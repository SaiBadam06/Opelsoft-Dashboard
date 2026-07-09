import { createClient } from "@/lib/supabase/server";
import type {
  RequirementPriority,
  RequirementStatus,
} from "@/lib/job-constants";

export interface Requirement {
  id: string;
  title: string;
  vendor_id: string | null;
  end_client: string | null;
  experience: string | null;
  skills: string | null;
  location: string | null;
  remote: boolean;
  rate: number | null;
  employment_type: string | null;
  priority: RequirementPriority;
  status: RequirementStatus;
  closing_date: string | null;
  notes: string | null;
  // Email-intake fields (migration 0014).
  nice_to_have_skills: string | null;
  work_authorization: string | null;
  duration: string | null;
  work_mode: string | null;
  contact_name: string | null;
  contact_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequirementWithVendor extends Requirement {
  vendor_name: string | null;
}

const COLUMNS =
  "id, title, vendor_id, end_client, experience, skills, location, remote, rate, employment_type, priority, status, closing_date, notes, nice_to_have_skills, work_authorization, duration, work_mode, contact_name, contact_email, created_at, updated_at";

export async function listRequirements(): Promise<RequirementWithVendor[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("requirements")
    .select(`${COLUMNS}, vendors(name)`)
    .order("updated_at", { ascending: false });
  const rows =
    (data as unknown as
      | (Requirement & { vendors: { name: string } | null })[]
      | null) ?? [];
  return rows.map((r) => ({ ...r, vendor_name: r.vendors?.name ?? null }));
}

export async function getRequirement(
  id: string,
): Promise<RequirementWithVendor | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("requirements")
    .select(`${COLUMNS}, vendors(name)`)
    .eq("id", id)
    .single();
  if (!data) return null;
  const r = data as unknown as Requirement & {
    vendors: { name: string } | null;
  };
  return { ...r, vendor_name: r.vendors?.name ?? null };
}

export async function requirementOptions(): Promise<
  { id: string; title: string }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("requirements")
    .select("id, title")
    .order("updated_at", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
  }));
}

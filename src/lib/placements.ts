import { createClient } from "@/lib/supabase/server";
import type { PlacementStatus } from "@/lib/work-constants";

export interface Placement {
  id: string;
  candidate_id: string | null;
  recruiter: string | null;
  opt_recruiter: string | null;
  vendor_id: string | null;
  end_client: string | null;
  new_exp: string | null;
  rate: number | null;
  placement_date: string | null;
  project_start_date: string | null;
  bgv_date: string | null;
  in_out: string | null;
  project_end_date: string | null;
  feedback: string | null;
  status: PlacementStatus;
  created_at: string;
  updated_at: string;
}

export interface PlacementRow extends Placement {
  candidate_name: string | null;
  vendor_name: string | null;
}

const COLUMNS =
  "id, candidate_id, recruiter, opt_recruiter, vendor_id, end_client, new_exp, rate, placement_date, project_start_date, bgv_date, in_out, project_end_date, feedback, status, created_at, updated_at";

type Joined = Placement & {
  candidates: { full_name: string } | null;
  vendors: { name: string } | null;
};

export async function listPlacements(): Promise<PlacementRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("placements")
    .select(`${COLUMNS}, candidates(full_name), vendors(name)`)
    .order("placement_date", { ascending: false, nullsFirst: false });
  return ((data as unknown as Joined[] | null) ?? []).map((p) => ({
    ...p,
    candidate_name: p.candidates?.full_name ?? null,
    vendor_name: p.vendors?.name ?? null,
  }));
}

import { createClient } from "@/lib/supabase/server";
import type { PrimeLayer, SubmissionStatus } from "@/lib/job-constants";

export interface Submission {
  id: string;
  candidate_id: string | null;
  requirement_id: string | null;
  vendor_id: string | null;
  end_client: string | null;
  prime_layer: PrimeLayer | null;
  rate: number | null;
  submitted_date: string;
  resume_version: string | null;
  status: SubmissionStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubmissionRow extends Submission {
  candidate_name: string | null;
  requirement_title: string | null;
  vendor_name: string | null;
}

const COLUMNS =
  "id, candidate_id, requirement_id, vendor_id, end_client, prime_layer, rate, submitted_date, resume_version, status, notes, created_at, updated_at";

type Joined = Submission & {
  candidates: { full_name: string } | null;
  requirements: { title: string } | null;
  vendors: { name: string } | null;
};

function joinRow(s: Joined): SubmissionRow {
  return {
    ...s,
    candidate_name: s.candidates?.full_name ?? null,
    requirement_title: s.requirements?.title ?? null,
    vendor_name: s.vendors?.name ?? null,
  };
}

export async function listSubmissions(): Promise<SubmissionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("submissions")
    .select(
      `${COLUMNS}, candidates(full_name), requirements(title), vendors(name)`,
    )
    .order("submitted_date", { ascending: false });
  return ((data as unknown as Joined[] | null) ?? []).map(joinRow);
}

export async function getSubmission(id: string): Promise<SubmissionRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("submissions")
    .select(
      `${COLUMNS}, candidates(full_name), requirements(title), vendors(name)`,
    )
    .eq("id", id)
    .single();
  if (!data) return null;
  return joinRow(data as unknown as Joined);
}

export interface SubmissionStatusEvent {
  id: string;
  from_status: SubmissionStatus | null;
  to_status: SubmissionStatus;
  changed_by_name: string | null;
  changed_at: string;
}

export async function getSubmissionStatusHistory(
  submissionId: string,
): Promise<SubmissionStatusEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("submission_status_history")
    .select("id, from_status, to_status, changed_by_name, changed_at")
    .eq("submission_id", submissionId)
    .order("changed_at", { ascending: false });
  return (data as unknown as SubmissionStatusEvent[] | null) ?? [];
}

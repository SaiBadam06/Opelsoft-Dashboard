import { createClient } from "@/lib/supabase/server";
import type { PrimeLayer, SubmissionStatus } from "@/lib/job-constants";
import { SUBMISSION_STATUSES } from "@/lib/job-constants";

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

export interface StatusLogRow {
  id: string;
  submission_id: string;
  candidate_name: string | null;
  from_status: SubmissionStatus | null;
  to_status: SubmissionStatus;
  changed_by_name: string | null;
  changed_at: string;
}

export interface LogFilters {
  candidate?: string;
  status?: SubmissionStatus;
  from?: string;
  to?: string;
}

export function parseLogFilters(searchParams: {
  [key: string]: string | string[] | undefined;
}): LogFilters {
  const filters: LogFilters = {};
  
  const getSingle = (val: string | string[] | undefined) =>
    Array.isArray(val) ? val[0] : val;

  const candidate = getSingle(searchParams.candidate);
  if (candidate) filters.candidate = candidate;

  const statusStr = getSingle(searchParams.status);
  if (
    statusStr &&
    SUBMISSION_STATUSES.some((s) => s.value === statusStr)
  ) {
    filters.status = statusStr as SubmissionStatus;
  }

  const from = getSingle(searchParams.from);
  if (from) filters.from = from;

  const to = getSingle(searchParams.to);
  if (to) filters.to = to;

  return filters;
}

type LogJoined = {
  id: string;
  from_status: SubmissionStatus | null;
  to_status: SubmissionStatus;
  changed_by_name: string | null;
  changed_at: string;
  submissions: {
    id: string;
    candidate_id: string;
    candidates: { full_name: string } | null;
  } | null;
};

export async function listStatusLogs(filters: LogFilters): Promise<StatusLogRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("submission_status_history")
    .select(
      "id, from_status, to_status, changed_by_name, changed_at, submissions!inner(id, candidate_id, candidates(full_name))"
    )
    .order("changed_at", { ascending: false })
    .limit(500);

  if (filters.status) {
    query = query.eq("to_status", filters.status);
  }
  if (filters.from) {
    query = query.gte("changed_at", filters.from);
  }
  if (filters.to) {
    // End of day logic for 'to' date string
    // Assuming format YYYY-MM-DD
    query = query.lte("changed_at", filters.to + "T23:59:59.999Z");
  }
  if (filters.candidate) {
    query = query.eq("submissions.candidate_id", filters.candidate);
  }

  const { data } = await query;

  return ((data as unknown as LogJoined[] | null) ?? []).map((row) => ({
    id: row.id,
    submission_id: row.submissions?.id ?? "",
    candidate_name: row.submissions?.candidates?.full_name ?? null,
    from_status: row.from_status,
    to_status: row.to_status,
    changed_by_name: row.changed_by_name,
    changed_at: row.changed_at,
  }));
}

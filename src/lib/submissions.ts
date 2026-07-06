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

export interface ListStatusLogsResult {
  logs: StatusLogRow[];
  error: string | null;
}

function filterParam(
  val: string | string[] | undefined,
): string | undefined {
  const raw = Array.isArray(val) ? val[0] : val;
  const trimmed = (raw ?? "").trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Inclusive calendar-day upper bound as an exclusive next-day date string. */
function dayAfter(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function parseLogFilters(searchParams: {
  [key: string]: string | string[] | undefined;
}): LogFilters {
  const filters: LogFilters = {};

  const candidate = filterParam(searchParams.candidate);
  if (candidate) filters.candidate = candidate;

  const statusStr = filterParam(searchParams.status);
  if (
    statusStr &&
    SUBMISSION_STATUSES.some((s) => s.value === statusStr)
  ) {
    filters.status = statusStr as SubmissionStatus;
  }

  const from = filterParam(searchParams.from);
  if (from) filters.from = from;

  const to = filterParam(searchParams.to);
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

export async function listStatusLogs(
  filters: LogFilters,
): Promise<ListStatusLogsResult> {
  if (filters.candidate) {
    const supabase = await createClient();
    const { data: subs, error: subsError } = await supabase
      .from("submissions")
      .select("id")
      .eq("candidate_id", filters.candidate);
    if (subsError) return { logs: [], error: subsError.message };
    const ids = (subs ?? []).map((s) => s.id);
    if (ids.length === 0) return { logs: [], error: null };
    const { candidate: _c, ...rest } = filters;
    return listStatusLogsBySubmissionIds(ids, rest);
  }

  return listStatusLogsBySubmissionIds(null, filters);
}

async function listStatusLogsBySubmissionIds(
  submissionIds: string[] | null,
  filters: LogFilters,
): Promise<ListStatusLogsResult> {
  const supabase = await createClient();
  let query = supabase
    .from("submission_status_history")
    .select(
      "id, from_status, to_status, changed_by_name, changed_at, submissions!inner(id, candidate_id, candidates(full_name))",
    )
    .order("changed_at", { ascending: false })
    .limit(500);

  if (submissionIds) {
    query = query.in("submission_id", submissionIds);
  }
  if (filters.status) {
    query = query.eq("to_status", filters.status);
  }
  if (filters.from) {
    query = query.gte("changed_at", filters.from);
  }
  if (filters.to) {
    query = query.lt("changed_at", dayAfter(filters.to));
  }

  const { data, error } = await query;
  if (error) return { logs: [], error: error.message };

  const logs = ((data as unknown as LogJoined[] | null) ?? []).map((row) => ({
    id: row.id,
    submission_id: row.submissions?.id ?? "",
    candidate_name: row.submissions?.candidates?.full_name ?? null,
    from_status: row.from_status,
    to_status: row.to_status,
    changed_by_name: row.changed_by_name,
    changed_at: row.changed_at,
  }));

  return { logs, error: null };
}

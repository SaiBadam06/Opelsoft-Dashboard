import { createClient } from "@/lib/supabase/server";
import type { InterviewResult } from "@/lib/work-constants";

export interface Interview {
  id: string;
  candidate_id: string | null;
  requirement_id: string | null;
  end_client: string | null;
  round: string | null;
  interview_date: string | null;
  mode: string | null;
  interviewer: string | null;
  feedback: string | null;
  result: InterviewResult;
  created_at: string;
  updated_at: string;
}

export interface InterviewRow extends Interview {
  candidate_name: string | null;
  requirement_title: string | null;
}

const COLUMNS =
  "id, candidate_id, requirement_id, end_client, round, interview_date, mode, interviewer, feedback, result, created_at, updated_at";

type Joined = Interview & {
  candidates: { full_name: string } | null;
  requirements: { title: string } | null;
};

export async function listInterviews(): Promise<InterviewRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("interviews")
    .select(`${COLUMNS}, candidates(full_name), requirements(title)`)
    .order("interview_date", { ascending: false, nullsFirst: false });
  return ((data as unknown as Joined[] | null) ?? []).map((i) => ({
    ...i,
    candidate_name: i.candidates?.full_name ?? null,
    requirement_title: i.requirements?.title ?? null,
  }));
}

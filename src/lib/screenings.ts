import { createClient } from "@/lib/supabase/server";
import type {
  RequirementMatch,
  ScoreBreakdown,
} from "@/lib/ai/score-candidate";

export interface ScreeningRow {
  id: string;
  candidate_id: string;
  candidate_name: string | null;
  score: number;
  eligibility: string;
  reason: string;
  score_breakdown: ScoreBreakdown[];
  requirement_matches: RequirementMatch[];
  created_at: string;
}

// Existing ATS screenings for a requirement, best score first.
export async function listScreenings(
  requirementId: string,
): Promise<ScreeningRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("candidate_screenings")
    .select(
      "id, candidate_id, score, eligibility, reason, score_breakdown, requirement_matches, created_at, candidates(full_name)",
    )
    .eq("requirement_id", requirementId)
    .order("score", { ascending: false });
  const rows =
    (data as unknown as
      | (Omit<ScreeningRow, "candidate_name"> & {
          candidates: { full_name: string } | null;
        })[]
      | null) ?? [];
  return rows.map((r) => ({
    ...r,
    candidate_name: r.candidates?.full_name ?? null,
  }));
}

export interface CandidateScreeningRow {
  id: string;
  requirement_id: string;
  requirement_title: string | null;
  score: number;
  eligibility: string;
  reason: string;
  score_breakdown: ScoreBreakdown[];
  requirement_matches: RequirementMatch[];
  created_at: string;
}

// Existing ATS screenings for one candidate, across requirements, best first.
export async function listCandidateScreenings(
  candidateId: string,
): Promise<CandidateScreeningRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("candidate_screenings")
    .select(
      "id, requirement_id, score, eligibility, reason, score_breakdown, requirement_matches, created_at, requirements(title)",
    )
    .eq("candidate_id", candidateId)
    .order("score", { ascending: false });
  const rows =
    (data as unknown as
      | (Omit<CandidateScreeningRow, "requirement_title"> & {
          requirements: { title: string } | null;
        })[]
      | null) ?? [];
  return rows.map((r) => ({
    ...r,
    requirement_title: r.requirements?.title ?? null,
  }));
}

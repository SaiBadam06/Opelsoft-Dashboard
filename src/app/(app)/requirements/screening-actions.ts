"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getRequirement } from "@/lib/requirements";
import { listCandidates, getCandidate } from "@/lib/candidates";
import { buildSpec, buildProfile, scoreCandidate } from "@/lib/ai/score-candidate";

// Newest stored resume parse for a candidate (they may have several), or undefined.
async function latestParse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  candidateId: string,
): Promise<unknown> {
  const { data } = await supabase
    .from("candidate_parsings")
    .select("parsed")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0]?.parsed;
}

// Score every candidate the recruiter can see against this requirement and
// persist the results (upsert, so re-running refreshes scores). Reads all
// candidate data from the DB — no resume upload.
export async function screenCandidatesAction(requirementId: string) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };

  const requirement = await getRequirement(requirementId);
  if (!requirement) return { error: "Requirement not found." };

  const candidates = await listCandidates();
  if (candidates.length === 0) return { error: "No candidates to screen." };

  const supabase = await createClient();

  // Pull stored resume parses in one query; enrich scoring when present.
  const { data: parsings } = await supabase
    .from("candidate_parsings")
    .select("candidate_id, parsed")
    .in(
      "candidate_id",
      candidates.map((c) => c.id),
    );
  const parseByCandidate = new Map<string, unknown>(
    (parsings ?? []).map((p) => [p.candidate_id as string, p.parsed]),
  );

  const spec = buildSpec(requirement);

  let scored = 0;
  let failed = 0;
  for (const c of candidates) {
    const result = await scoreCandidate(
      spec,
      buildProfile(c, parseByCandidate.get(c.id)),
    );
    if (!result) {
      failed++;
      continue;
    }
    const { error } = await supabase.from("candidate_screenings").upsert(
      {
        requirement_id: requirementId,
        candidate_id: c.id,
        score: result.score,
        eligibility: result.eligibility,
        reason: result.reason,
        score_breakdown: result.score_breakdown,
        requirement_matches: result.requirement_matches,
        created_by: me.id,
      },
      { onConflict: "requirement_id,candidate_id" },
    );
    if (error) failed++;
    else scored++;
  }

  revalidatePath(`/requirements/${requirementId}`);
  if (scored === 0) {
    return { error: "Scoring failed for all candidates (check GEMINI_API_KEY / quota)." };
  }
  return { ok: true as const, scored, failed };
}

// Score a single candidate against a single requirement (candidate-page view).
export async function scoreCandidateAction(
  candidateId: string,
  requirementId: string,
) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  if (!requirementId) return { error: "Pick a requirement to score against." };

  const [requirement, candidate] = await Promise.all([
    getRequirement(requirementId),
    getCandidate(candidateId),
  ]);
  if (!requirement) return { error: "Requirement not found." };
  if (!candidate) return { error: "Candidate not found." };

  const supabase = await createClient();
  const result = await scoreCandidate(
    buildSpec(requirement),
    buildProfile(candidate, await latestParse(supabase, candidateId)),
  );
  if (!result) {
    return { error: "Scoring failed (check GEMINI_API_KEY / quota)." };
  }

  const { error } = await supabase.from("candidate_screenings").upsert(
    {
      requirement_id: requirementId,
      candidate_id: candidateId,
      score: result.score,
      eligibility: result.eligibility,
      reason: result.reason,
      score_breakdown: result.score_breakdown,
      requirement_matches: result.requirement_matches,
      created_by: me.id,
    },
    { onConflict: "requirement_id,candidate_id" },
  );
  if (error) return { error: error.message };
  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath(`/requirements/${requirementId}`);
  return { ok: true as const, score: result.score };
}

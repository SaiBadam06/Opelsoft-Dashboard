import type { createClient } from "./supabase/server";
import {
  resolvePipelineStage,
  shouldCreatePlacement,
  statusForStage,
} from "./pipeline-sync";
import type { PipelineStage } from "./candidate-constants";
import type { SubmissionStatus } from "./job-constants";
import type { InterviewResult } from "./work-constants";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export interface PlaceableSubmission {
  candidate_id: string;
  vendor_id: string | null;
  end_client: string | null;
  rate: number | null;
  status: SubmissionStatus;
}

// Step 6 guard: does this candidate have any submission or interview? Advanced
// and terminal stages require it. Fail-open (return true) on a query error so a
// transient DB hiccup never blocks a legitimate stage change.
export async function candidateHasActivity(
  supabase: ServerClient,
  candidateId: string,
): Promise<boolean> {
  try {
    const [{ count: subs }, { count: ivs }] = await Promise.all([
      supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("candidate_id", candidateId),
      supabase
        .from("interviews")
        .select("id", { count: "exact", head: true })
        .eq("candidate_id", candidateId),
    ]);
    return (subs ?? 0) > 0 || (ivs ?? 0) > 0;
  } catch {
    return true;
  }
}

// Step 3: when a submission is `placed`, create a placement row (auto-filled
// from the submission) unless the candidate already has an active placement.
// Best-effort: never throws; never auto-deletes on un-place.
export async function ensurePlacementFromSubmission(
  supabase: ServerClient,
  submission: PlaceableSubmission,
  actorId: string,
): Promise<void> {
  try {
    if (submission.status !== "placed") return;
    const { data: active } = await supabase
      .from("placements")
      .select("id")
      .eq("candidate_id", submission.candidate_id)
      .eq("status", "active")
      .limit(1);
    if (!shouldCreatePlacement(submission.status, (active?.length ?? 0) > 0)) return;
    await supabase.from("placements").insert({
      candidate_id: submission.candidate_id,
      vendor_id: submission.vendor_id,
      end_client: submission.end_client,
      rate: submission.rate,
      placement_date: new Date().toISOString().slice(0, 10),
      status: "active",
      created_by: actorId,
    });
  } catch {
    // best-effort — the submission write already succeeded.
  }
}

// Step 5: when a candidate is dragged/set to a stage on the Pipeline board,
// write the change back into their LATEST submission (if the stage has a clean
// submission equivalent). Updates the submission directly — the forward-only
// sync is intentionally NOT re-run, so a backward drag sticks. Best-effort.
export async function writeBackStageToSubmission(
  supabase: ServerClient,
  candidateId: string,
  stage: PipelineStage,
  actorId: string,
): Promise<void> {
  try {
    const status = statusForStage(stage);
    if (!status) return;
    const { data: subs } = await supabase
      .from("submissions")
      .select("id, candidate_id, vendor_id, end_client, rate, status")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false })
      .limit(1);
    const sub = subs?.[0];
    if (!sub) return;
    await supabase.from("submissions").update({ status }).eq("id", sub.id);
    if (status === "placed") {
      await ensurePlacementFromSubmission(supabase, { ...sub, status }, actorId);
    }
  } catch {
    // best-effort — the stage change already succeeded.
  }
}

// Recompute a candidate's pipeline_stage from their submissions and interviews
// and persist it when it changed. Best-effort: never throws — a sync failure
// must not fail the caller's primary write. The candidates UPDATE fires the
// existing activity-log trigger, so stage changes are recorded automatically.
export async function syncCandidateStage(
  supabase: ServerClient,
  candidateId: string,
  actorId: string,
): Promise<void> {
  try {
    const { data: cand } = await supabase
      .from("candidates")
      .select("pipeline_stage")
      .eq("id", candidateId)
      .single();
    if (!cand) return;

    const [{ data: subs }, { data: ivs }] = await Promise.all([
      supabase.from("submissions").select("status").eq("candidate_id", candidateId),
      supabase
        .from("interviews")
        .select("round, result")
        .eq("candidate_id", candidateId),
    ]);

    const statuses = (subs ?? []).map((s) => s.status as SubmissionStatus);
    const interviews = (ivs ?? []).map((i) => ({
      round: (i.round ?? null) as string | null,
      result: i.result as InterviewResult,
    }));
    const current = cand.pipeline_stage as PipelineStage;
    const next = resolvePipelineStage(current, statuses, interviews);

    if (next !== current) {
      await supabase
        .from("candidates")
        .update({ pipeline_stage: next, updated_by: actorId })
        .eq("id", candidateId);
    }
  } catch {
    // best-effort — primary write already succeeded; do not surface sync errors.
  }
}

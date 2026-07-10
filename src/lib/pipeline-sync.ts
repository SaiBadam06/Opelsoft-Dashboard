import { PIPELINE_STAGES, type PipelineStage } from "./candidate-constants";
import type { SubmissionStatus } from "./job-constants";
import type { InterviewResult } from "./work-constants";

// Step 1 mapping: submission status -> pipeline stage.
// rejected / on_hold are intentionally omitted — a candidate is not rejected
// just because one of several submissions was. Terminal semantics are Step 4.
export const STATUS_TO_STAGE: Partial<Record<SubmissionStatus, PipelineStage>> = {
  matched: "matched",
  rtr_requested: "matched",
  rtr_received: "matched",
  submitted: "submitted",
  client_review: "submitted",
  interview_requested: "interview_r1",
  interview_scheduled: "interview_r1",
  selected: "offer_released",
  placed: "placed",
};

const rank = (stage: PipelineStage): number =>
  PIPELINE_STAGES.findIndex((s) => s.value === stage);

export interface InterviewInput {
  round: string | null;
  result: InterviewResult;
}

// Map one interview to a pipeline stage. `round` is free text; a cancelled
// interview is ignored (returns null). failed/scheduled/pending all count as
// "reached that round" for now (terminal handling is Step 4).
export function stageFromInterview(
  round: string | null,
  result: InterviewResult,
): PipelineStage | null {
  if (result === "cancelled") return null;
  const text = (round ?? "").toLowerCase();
  if (/screen/.test(text)) return "screening";
  if (/final|f2f|last/.test(text)) return "final_interview";
  const digits = text.match(/\d+/);
  if (digits) {
    const n = parseInt(digits[0], 10);
    if (n >= 3) return "final_interview";
    if (n === 2) return "interview_r2";
    return "interview_r1";
  }
  return "interview_r1"; // an interview exists -> at least round 1
}

const isTerminal = (stage: PipelineStage): boolean =>
  stage === "rejected" || stage === "hold";

// Step 6 guard: pre-submission stages are freely settable; everything from
// `submitted` onward (incl. terminal rejected/hold) requires the candidate to
// actually have a submission or interview behind it.
const FREE_STAGES: readonly PipelineStage[] = [
  "new",
  "contacted",
  "interested",
  "resume_received",
  "screening",
  "matched",
];

export function stageRequiresBacking(stage: PipelineStage): boolean {
  return !FREE_STAGES.includes(stage);
}

// When a submission is deleted, a gated stage must still be justified by the
// candidate's remaining submissions/interviews — so recompute it from scratch
// (this may regress the stage). Free pre-submission stages are left as set.
export function stageAfterRemoval(
  currentStage: PipelineStage,
  submissionStatuses: SubmissionStatus[],
  interviews: InterviewInput[],
): PipelineStage {
  if (!stageRequiresBacking(currentStage)) return currentStage;
  return resolvePipelineStage("new", submissionStatuses, interviews);
}

// Pure: given a candidate's current stage plus their submissions and
// interviews, return the stage they should be at.
//
//  - Positive signal (any mapped submission or non-cancelled interview) wins:
//    the furthest positive stage, forward-only. A terminal current stage
//    (rejected/hold) is revived by a positive signal.
//  - No positive signal: derive a terminal stage from the submissions —
//    on_hold (paused, still alive) beats rejected. No submissions → unchanged.
export function resolvePipelineStage(
  currentStage: PipelineStage,
  submissionStatuses: SubmissionStatus[],
  interviews: InterviewInput[],
): PipelineStage {
  const positive: PipelineStage[] = [];
  for (const status of submissionStatuses) {
    const stage = STATUS_TO_STAGE[status];
    if (stage) positive.push(stage);
  }
  for (const iv of interviews) {
    const stage = stageFromInterview(iv.round, iv.result);
    if (stage) positive.push(stage);
  }

  if (positive.length > 0) {
    // Forward-only among the current stage and the positive stages; a terminal
    // current stage does not pin the candidate, so a positive signal revives it.
    let best: PipelineStage | null = isTerminal(currentStage) ? null : currentStage;
    let bestRank = best ? rank(best) : -1;
    for (const stage of positive) {
      const r = rank(stage);
      if (r > bestRank) {
        best = stage;
        bestRank = r;
      }
    }
    return best as PipelineStage;
  }

  // No positive signal — reflect the terminal state of the submissions.
  if (submissionStatuses.includes("on_hold")) return "hold";
  if (submissionStatuses.includes("rejected")) return "rejected";
  return currentStage;
}

// Step 1 convenience wrapper (submissions only).
export function resolveStageFromSubmissions(
  currentStage: PipelineStage,
  statuses: SubmissionStatus[],
): PipelineStage {
  return resolvePipelineStage(currentStage, statuses, []);
}

// Step 5: reverse map for pipeline-drag write-back. Only stages with a clean
// submission equivalent; interview rounds (r2/final) and pre-submission stages
// have none, so a drag there leaves submissions untouched.
export const STAGE_TO_STATUS: Partial<Record<PipelineStage, SubmissionStatus>> = {
  matched: "matched",
  submitted: "submitted",
  interview_r1: "interview_scheduled",
  offer_released: "selected",
  placed: "placed",
  rejected: "rejected",
  hold: "on_hold",
};

export function statusForStage(stage: PipelineStage): SubmissionStatus | null {
  return STAGE_TO_STATUS[stage] ?? null;
}

// Step 3: a `placed` submission should create a placement row, but only if the
// candidate has no active placement yet (no submission_id link exists, so this
// guard prevents duplicates on re-toggling and respects manual placements).
export function shouldCreatePlacement(
  submissionStatus: SubmissionStatus,
  hasActivePlacement: boolean,
): boolean {
  return submissionStatus === "placed" && !hasActivePlacement;
}

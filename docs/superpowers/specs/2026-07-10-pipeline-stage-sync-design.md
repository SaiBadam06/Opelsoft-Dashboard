# Pipeline Stage Sync — Design (Issue #11)

Date: 2026-07-10
Branch: `feat/pipeline-stage-sync-11`
Status: approved (Step 1)

## Problem

`candidates.pipeline_stage` is never updated by the submissions or interviews
flows. It only moves via manual candidate edit or the pipeline drag board. So a
recruiter can advance a submission (`Submitted → Interview Scheduled → Placed`)
and the Pipeline board / dashboard never reflect it. Verified live and in code
(nothing outside `candidates` writes `pipeline_stage`; the existing DB triggers
only log to `activity_logs` / `submission_status_history`).

## Decision

Single source of truth in the **server action** (app layer). The server action
recomputes and saves the stage (backend), then revalidates the affected views so
the UI reflects it (frontend). No DB trigger — the computation lives in exactly
one place, and is fully unit-tested. (DB-trigger backstop deliberately declined
to avoid two implementations that could disagree.)

Delivered in small, independently-verifiable steps. **This spec covers Step 1.**

## Step 1 — submissions → pipeline stage

### Behavior (the rule that must be exact)

When any of a candidate's submissions change, recompute `pipeline_stage`:

1. Map each submission's status to a stage (table below).
2. Take the **furthest** mapped stage by `PIPELINE_STAGES` order.
3. **Forward-only:** the candidate stage may only advance. If the furthest
   mapped stage is not further than the current stage, leave it unchanged. This
   respects manually-set early stages and prevents accidental regressions when a
   submission is corrected downward.
4. `rejected` / `on_hold` are **ignored** in Step 1 (a candidate is not rejected
   because one of several submissions was). Terminal semantics are a later step.
5. A candidate already in a terminal stage (`rejected` / `hold`) is **left
   unchanged** in Step 1 — auto-resurrecting terminal states is deferred to
   Step 4. (Falls out of forward-only: `rejected`/`hold` sit at the end of the
   stage order, so no mapped submission stage is ever "further".)
6. No submissions, or only unmapped/ignored statuses → **no change**.

### Mapping

| submission status                          | pipeline stage      |
| ------------------------------------------ | ------------------- |
| matched, rtr_requested, rtr_received       | matched             |
| submitted, client_review                   | submitted           |
| interview_requested, interview_scheduled   | interview_r1        |
| selected                                   | offer_released      |
| placed                                     | placed              |
| rejected, on_hold                          | (ignored in Step 1) |

### Code

- `src/lib/pipeline-sync.ts`
  - `STATUS_TO_STAGE: Partial<Record<SubmissionStatus, PipelineStage>>` — the map above.
  - `resolveStageFromSubmissions(currentStage: PipelineStage, statuses: SubmissionStatus[]): PipelineStage`
    — **pure**, no I/O. Returns the new stage (or `currentStage` unchanged).
    Ordering uses the index in `PIPELINE_STAGES`.
- `src/lib/pipeline-sync.server.ts` (or a function in submissions actions)
  - `syncCandidateStageFromSubmissions(supabase, candidateId)` — reads that
    candidate's submission statuses, calls the pure resolver, and `UPDATE`s the
    candidate row **only when the stage changes**. Best-effort: a sync failure
    must not fail the underlying submission write (log, don't throw).
- Wire the helper into `src/app/(app)/submissions/actions.ts`:
  `createSubmission`, `setSubmissionStatus`. (`deleteSubmission` is a no-op
  under forward-only — deleting a submission can never lower the stage — so it
  is left unwired until Step 4 adds recompute/regression semantics.)
- After a stage change, `revalidatePath` for `/pipeline`, `/candidates`,
  `/dashboard` (in addition to existing `/submissions` revalidations).

### Tests (written first)

`src/lib/pipeline-sync.test.ts` — pure-function cases:

- single `submitted` → `submitted`
- single `interview_scheduled` → `interview_r1`
- several statuses → furthest wins (`submitted` + `interview_scheduled` → `interview_r1`)
- forward-only: current `interview_r2`, submission `submitted` → stays `interview_r2`
- `rejected` / `on_hold` ignored (current `screening`, only `rejected` → stays `screening`)
- empty statuses → unchanged
- unmapped/unknown status → unchanged
- `placed` → `placed`
- current terminal (`rejected`) + submission `placed` → stays `rejected` (Step 1 conservative)

### Manual verification

Re-run the issue's live repro on `E2E Test Applicant`:
create submission `Submitted` (stage → Submitted) → `Interview Scheduled`
(→ Interview R1) → `Placed` (→ Placed); confirm on the Pipeline board and
`/candidates`; then delete the test submission.

## Step 2 — interviews → pipeline stage

Interviews also advance the stage, combined with submissions (furthest across
**both** wins, still forward-only).

### Interview → stage

`interviews.round` is free text (form placeholder "Round 1"); `result` is
`scheduled | pending | passed | failed | cancelled`.

- `result = cancelled` → the interview did not happen → **ignored**.
- Otherwise map by the round text (UI presets: Screening / R1 / R2 / R3 / Final / HR):
  - contains `screen` → `screening` (a screening call is pre-interview, not R1)
  - contains `final` / `f2f` / `last`, or a number ≥ 3 → `final_interview`
  - number `2` → `interview_r2`
  - number `1` (or `0`) → `interview_r1`
  - no recognizable number and not "final" (e.g. "Technical", "HR", empty) →
    `interview_r1` (an interview exists, so at least R1)
- `scheduled` / `pending` count (a scheduled R2 means the candidate has reached
  R2). `failed` counts as "reached that round" for now; converting a failed
  interview to a terminal stage is Step 4.

### Code changes

- `src/lib/pipeline-sync.ts`
  - `stageFromInterview(round: string | null, result: InterviewResult): PipelineStage | null` (pure).
  - `resolvePipelineStage(currentStage, submissionStatuses, interviews): PipelineStage`
    — furthest across submissions + interviews, forward-only.
  - `resolveStageFromSubmissions` refactored to delegate to `resolvePipelineStage(current, statuses, [])`
    (Step 1 tests stay green).
- `src/lib/pipeline-sync.server.ts` — helper renamed `syncCandidateStage`, now
  reads **both** the candidate's submissions and interviews and calls
  `resolvePipelineStage`.
- Wire into `src/app/(app)/interviews/actions.ts`: `createInterview`,
  `setInterviewResult`, `setInterviewRound` (+ revalidate `/pipeline`,
  `/candidates`, `/dashboard`). Submission actions call the renamed helper.

### Tests (added first)

`stageFromInterview`: round "1"/"2"/"final"/none → r1/r2/final/r1; `cancelled` → null.
`resolvePipelineStage`: submission `submitted` + interview round 2 → `interview_r2`;
interview-only → correct stage; cancelled ignored; forward-only; terminal unchanged.

### Manual verification

On a fresh candidate: log an interview (Round 2, Scheduled) → stage `Interview R2`;
change result to Cancelled → stage does not regress (forward-only).

## Step 3 — submission `placed` → placement row

When a submission becomes `placed`, auto-create a `placements` row so the
Placements page and the dashboard "Placements" KPI (which counts placement rows,
`dashboard.ts`) reflect it. Step 1 already moves the candidate to the `placed`
stage, so the two counts now move together for new placements.

### Behavior

- Trigger: a submission's status is/goes to `placed` (`createSubmission`,
  `setSubmissionStatus`).
- **Idempotency (no `submission_id` column exists → app-side guard):** create a
  placement only if the candidate has **no active placement**. Prevents
  duplicates when a submission is toggled `placed → other → placed`, and
  respects manually-created placements.
- **Auto-fill** from the submission: `candidate_id`, `vendor_id`, `end_client`,
  `rate`; `placement_date = today`; `status = active`; `created_by = actor`.
- **Never auto-delete.** Un-placing a submission does not remove a placement (a
  placement is a real event); forward-only, same philosophy as the stage sync.

### Code

- `src/lib/pipeline-sync.ts` — `shouldCreatePlacement(status, hasActivePlacement): boolean`
  (pure; `status === "placed" && !hasActivePlacement`).
- `src/lib/pipeline-sync.server.ts` — `ensurePlacementFromSubmission(supabase, submission, actorId)`:
  best-effort; checks for an active placement, inserts one if none.
- `submissions/actions.ts` — both actions select the submission's
  `candidate_id, vendor_id, end_client, rate, status`, call `syncCandidateStage`
  **and** `ensurePlacementFromSubmission`, and revalidate `/placements` too.
- No `dashboard.ts` change — the KPI already counts placement rows.

### Tests / verification

`shouldCreatePlacement`: placed + no active → true; placed + active → false;
non-placed → false. Live: set a submission to `Placed` → a placement appears on
`/placements` and the dashboard "Placements" count increments; setting a second
submission for the same candidate to `Placed` does **not** add a duplicate.

### Not in scope

Backfilling placements for the historical `placed`-stage candidates that predate
this change (a one-off data task, not new behavior).

## Step 4 — rejected / hold terminal semantics

Steps 1–2 ignored `rejected` / `on_hold` submissions. Step 4 gives them meaning
in `resolvePipelineStage`:

- **Positive signal wins.** If the candidate has any mapped submission or
  non-cancelled interview, use the furthest positive stage (Steps 1–2 logic).
  Exception: if the current stage is terminal (`rejected` / `hold`), a positive
  signal **revives** the candidate to that positive stage (forward-only no
  longer pins them in a terminal state).
- **No positive signal:** derive a terminal stage from the submissions:
  - any submission `on_hold` → `hold` (paused, still alive — wins over rejected)
  - else any submission `rejected` → `rejected`
  - else (no submissions / only cancelled interviews) → unchanged (manual
    stages preserved).
- Terminal derivation **can override** a higher progress stage — if every
  submission is rejected and nothing is active, the candidate is `rejected`
  regardless of how far they previously got.

### Behavior changes vs Step 1 (provisional tests updated)

- `("screening", ["rejected"])`: was `screening` → now `rejected`
- `("screening", ["on_hold"])`: was `screening` → now `hold`
- `("rejected", ["placed"])`: was `rejected` → now `placed` (revival)

### Code

- `src/lib/pipeline-sync.ts` — `resolvePipelineStage` gains the terminal branch;
  `stageFromInterview` / `STATUS_TO_STAGE` unchanged. No server-side or wiring
  change (the same `syncCandidateStage` already recomputes on every write).

### Tests

Updated provisional cases above; new: all-rejected → `rejected`; `on_hold` →
`hold`; mixed hold+rejected → `hold`; positive-beats-terminal; revival from
`rejected`/`hold`; terminal overrides a progress stage.

### Related data cleanup (not code, noted for the issue)

Candidate availability `status` (`available/offered/placed/inactive`) is a
separate field from `pipeline_stage`; the seed wrote workflow words
(`submitted`/`interviewing`) into `status`. The sync never touches `status`, so
this is a one-off data fix + `statusLabel` already falls back safely — tracked
under the duplicate/seed cleanup, not this step.

## Step 5 — pipeline drag → write back submission status (reverse sync)

Dragging a candidate on the Pipeline board (`setStage`) now also updates the
candidate's **latest** submission so the Submissions tab reflects the drag.

### Behavior

- Reverse map (only stages with a clean submission equivalent):
  `matched→matched`, `submitted→submitted`, `interview_r1→interview_scheduled`,
  `offer_released→selected`, `placed→placed`, `rejected→rejected`, `hold→on_hold`.
- Other stages (`new/contacted/interested/resume_received/screening`,
  `interview_r2/final_interview/offer_accepted`) → **no submission change**
  (no clean equivalent; R2/Final are interview concepts).
- Target: the candidate's **latest** submission (by `created_at desc`). Multiple
  submissions → only the latest changes. **No** submission → only the stage moves.
- The write-back updates the submission **directly** (not via `setSubmissionStatus`),
  so the forward-only sync is **not** re-run — a backward drag sticks instead of
  being overridden by a further submission.
- Consistency with Step 3: if the mapped status is `placed`, also call
  `ensurePlacementFromSubmission` (idempotent) so a drag-to-Placed creates the
  placement too.

### Code

- `src/lib/pipeline-sync.ts` — `STAGE_TO_STATUS` + `statusForStage(stage): SubmissionStatus | null` (pure).
- `src/lib/pipeline-sync.server.ts` — `writeBackStageToSubmission(supabase, candidateId, stage, actorId)`:
  maps the stage, finds the latest submission, updates it, and ensures a
  placement when placed. Best-effort.
- `candidates/actions.ts` `setStage` — call the helper after setting the stage;
  revalidate `/submissions` and `/dashboard` too.

### Tests / verification

`statusForStage`: each mapped stage → its status; unmapped stages → null. Live:
drag a candidate with one submission across stages → the submission's status in
the Submissions tab follows; a second (older) submission is left untouched.

## Step 6 — guard: advanced/terminal stages need backing data

A candidate may only be at an advanced or terminal stage if they actually have a
submission or interview. Prevents "Placed"/"Hold" (etc.) on a candidate with no
activity.

### Rule

- **Free** (settable anytime, pre-submission recruiting): `new`, `contacted`,
  `interested`, `resume_received`, `screening`, `matched`.
- **Gated** (require ≥1 submission or interview): `submitted`, `interview_r1`,
  `interview_r2`, `final_interview`, `offer_released`, `offer_accepted`,
  `placed`, `rejected`, `hold`.

### Code

- `src/lib/pipeline-sync.ts` — `stageRequiresBacking(stage): boolean` (pure).
- `src/lib/pipeline-sync.server.ts` — `candidateHasActivity(supabase, candidateId): Promise<boolean>`
  (true if the candidate has any submission or interview).
- Enforce in every user-driven stage write in `candidates/actions.ts`:
  - `setStage` (drag): gated + no activity → `{ error }` (board reverts + toasts).
  - `updateCandidate` (edit form): gated + no activity → `{ error }` (form shows it).
  - `createCandidateReturningId` (new form): a new candidate has no activity, so a
    gated stage → `{ error }`.
- The auto sync (`syncCandidateStage`) is unaffected — it only *derives* stages
  from real data, so it never violates the guard.

### Tests / verification

`stageRequiresBacking`: free stages → false, gated → true. Live: dragging a
submission-less candidate to Placed is rejected (snaps back with a toast); the
same drag works once the candidate has a submission.

## Out of scope

Duplicate-candidate cleanup and the resume-autofill 500 (separate issues).

import { describe, expect, it } from "vitest";
import {
  resolveStageFromSubmissions,
  resolvePipelineStage,
  stageFromInterview,
  shouldCreatePlacement,
  statusForStage,
  stageRequiresBacking,
} from "./pipeline-sync";
import type { SubmissionStatus } from "./job-constants";
import type { PipelineStage } from "./candidate-constants";

describe("resolveStageFromSubmissions", () => {
  it("maps a single 'submitted' submission to the submitted stage", () => {
    expect(resolveStageFromSubmissions("new", ["submitted"])).toBe("submitted");
  });

  it("maps interview_scheduled to interview_r1", () => {
    expect(resolveStageFromSubmissions("new", ["interview_scheduled"])).toBe(
      "interview_r1",
    );
  });

  it("maps the rtr/matched group to matched", () => {
    expect(resolveStageFromSubmissions("new", ["rtr_requested"])).toBe("matched");
    expect(resolveStageFromSubmissions("new", ["rtr_received"])).toBe("matched");
    expect(resolveStageFromSubmissions("new", ["matched"])).toBe("matched");
  });

  it("maps client_review to submitted and selected to offer_released", () => {
    expect(resolveStageFromSubmissions("new", ["client_review"])).toBe("submitted");
    expect(resolveStageFromSubmissions("new", ["selected"])).toBe("offer_released");
  });

  it("maps placed to placed", () => {
    expect(resolveStageFromSubmissions("new", ["placed"])).toBe("placed");
  });

  it("picks the furthest stage across several submissions", () => {
    expect(
      resolveStageFromSubmissions("new", ["submitted", "interview_scheduled"]),
    ).toBe("interview_r1");
    expect(
      resolveStageFromSubmissions("new", ["placed", "submitted", "matched"]),
    ).toBe("placed");
  });

  it("is forward-only: never regresses below the current stage", () => {
    expect(resolveStageFromSubmissions("interview_r2", ["submitted"])).toBe(
      "interview_r2",
    );
  });

  it("still advances on an active submission even if a rejected one is present", () => {
    expect(
      resolveStageFromSubmissions("new", ["rejected", "submitted"]),
    ).toBe("submitted");
  });

  it("revives a terminal candidate when a positive submission appears", () => {
    expect(resolveStageFromSubmissions("rejected", ["placed"])).toBe("placed");
    expect(resolveStageFromSubmissions("hold", ["placed"])).toBe("placed");
  });

  it("returns the current stage when there are no submissions", () => {
    expect(resolveStageFromSubmissions("screening", [])).toBe("screening");
  });

  it("ignores unknown statuses without throwing", () => {
    expect(
      resolveStageFromSubmissions("screening", [
        "not_a_real_status" as SubmissionStatus,
      ]),
    ).toBe("screening");
  });

  it("returns a valid PipelineStage type", () => {
    const result: PipelineStage = resolveStageFromSubmissions("new", ["placed"]);
    expect(result).toBe("placed");
  });
});

describe("stageFromInterview", () => {
  it("maps round text to the matching interview stage", () => {
    expect(stageFromInterview("Round 1", "scheduled")).toBe("interview_r1");
    expect(stageFromInterview("Round 2", "scheduled")).toBe("interview_r2");
    expect(stageFromInterview("Final", "scheduled")).toBe("final_interview");
    expect(stageFromInterview("Round 3", "pending")).toBe("final_interview");
  });

  it("maps the UI round presets (R1/R2/R3/Screening/HR)", () => {
    expect(stageFromInterview("R1", "scheduled")).toBe("interview_r1");
    expect(stageFromInterview("R2", "scheduled")).toBe("interview_r2");
    expect(stageFromInterview("R3", "scheduled")).toBe("final_interview");
    expect(stageFromInterview("Screening", "scheduled")).toBe("screening");
    expect(stageFromInterview("HR", "scheduled")).toBe("interview_r1");
  });

  it("defaults an unnumbered round to interview_r1", () => {
    expect(stageFromInterview("Technical", "pending")).toBe("interview_r1");
    expect(stageFromInterview(null, "scheduled")).toBe("interview_r1");
  });

  it("ignores a cancelled interview", () => {
    expect(stageFromInterview("Round 2", "cancelled")).toBeNull();
  });

  it("still counts a failed interview as reaching that round", () => {
    expect(stageFromInterview("Round 1", "failed")).toBe("interview_r1");
  });
});

describe("resolvePipelineStage (submissions + interviews)", () => {
  it("takes the furthest across submissions and interviews", () => {
    expect(
      resolvePipelineStage("new", ["submitted"], [
        { round: "Round 2", result: "scheduled" },
      ]),
    ).toBe("interview_r2");
  });

  it("advances from an interview alone", () => {
    expect(
      resolvePipelineStage("new", [], [{ round: "Final", result: "passed" }]),
    ).toBe("final_interview");
  });

  it("keeps a further submission over an earlier interview", () => {
    expect(
      resolvePipelineStage("new", ["placed"], [
        { round: "Round 1", result: "scheduled" },
      ]),
    ).toBe("placed");
  });

  it("is forward-only with interviews", () => {
    expect(
      resolvePipelineStage("interview_r2", [], [
        { round: "Round 1", result: "scheduled" },
      ]),
    ).toBe("interview_r2");
  });

  it("ignores cancelled interviews", () => {
    expect(
      resolvePipelineStage("screening", [], [
        { round: "Round 2", result: "cancelled" },
      ]),
    ).toBe("screening");
  });

  it("leaves a terminal candidate unchanged", () => {
    expect(
      resolvePipelineStage("placed", [], [{ round: "Final", result: "passed" }]),
    ).toBe("placed");
  });
});

describe("resolvePipelineStage terminal semantics (Step 4)", () => {
  it("marks a candidate rejected when all submissions are rejected", () => {
    expect(resolvePipelineStage("new", ["rejected"], [])).toBe("rejected");
    expect(resolvePipelineStage("screening", ["rejected", "rejected"], [])).toBe(
      "rejected",
    );
  });

  it("marks a candidate hold when a submission is on_hold and none are active", () => {
    expect(resolvePipelineStage("new", ["on_hold"], [])).toBe("hold");
  });

  it("treats on_hold as still-alive: hold wins over rejected", () => {
    expect(resolvePipelineStage("new", ["rejected", "on_hold"], [])).toBe("hold");
  });

  it("lets a terminal state override an earlier progress stage", () => {
    expect(resolvePipelineStage("interview_r2", ["rejected"], [])).toBe("rejected");
  });

  it("revives a rejected candidate via a scheduled interview", () => {
    expect(
      resolvePipelineStage("rejected", [], [{ round: "R1", result: "scheduled" }]),
    ).toBe("interview_r1");
  });

  it("prefers an active submission over a rejected one", () => {
    expect(resolvePipelineStage("new", ["rejected", "submitted"], [])).toBe(
      "submitted",
    );
  });

  it("leaves a candidate with no submissions unchanged", () => {
    expect(resolvePipelineStage("screening", [], [])).toBe("screening");
  });
});

describe("statusForStage (reverse map — Step 5 drag write-back)", () => {
  it("maps stages with a clean submission equivalent", () => {
    expect(statusForStage("matched")).toBe("matched");
    expect(statusForStage("submitted")).toBe("submitted");
    expect(statusForStage("interview_r1")).toBe("interview_scheduled");
    expect(statusForStage("offer_released")).toBe("selected");
    expect(statusForStage("placed")).toBe("placed");
    expect(statusForStage("rejected")).toBe("rejected");
    expect(statusForStage("hold")).toBe("on_hold");
  });

  it("returns null for stages with no submission equivalent", () => {
    expect(statusForStage("new")).toBeNull();
    expect(statusForStage("contacted")).toBeNull();
    expect(statusForStage("screening")).toBeNull();
    expect(statusForStage("interview_r2")).toBeNull();
    expect(statusForStage("final_interview")).toBeNull();
    expect(statusForStage("offer_accepted")).toBeNull();
  });
});

describe("stageRequiresBacking (Step 6 guard)", () => {
  it("does not gate pre-submission stages", () => {
    for (const s of [
      "new",
      "contacted",
      "interested",
      "resume_received",
      "screening",
      "matched",
    ] as const) {
      expect(stageRequiresBacking(s)).toBe(false);
    }
  });

  it("gates advanced and terminal stages", () => {
    for (const s of [
      "submitted",
      "interview_r1",
      "interview_r2",
      "final_interview",
      "offer_released",
      "offer_accepted",
      "placed",
      "rejected",
      "hold",
    ] as const) {
      expect(stageRequiresBacking(s)).toBe(true);
    }
  });
});

describe("shouldCreatePlacement", () => {
  it("creates a placement when placed and no active placement exists", () => {
    expect(shouldCreatePlacement("placed", false)).toBe(true);
  });

  it("does not duplicate when the candidate already has an active placement", () => {
    expect(shouldCreatePlacement("placed", true)).toBe(false);
  });

  it("does nothing for non-placed statuses", () => {
    expect(shouldCreatePlacement("submitted", false)).toBe(false);
    expect(shouldCreatePlacement("interview_scheduled", false)).toBe(false);
  });
});

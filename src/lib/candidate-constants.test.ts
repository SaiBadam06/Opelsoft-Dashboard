import { describe, it, expect } from "vitest";
import {
  PIPELINE_STAGES,
  STATUS_OPTIONS,
  stageLabel,
  statusLabel,
  statusBadgeClass,
} from "@/lib/candidate-constants";

describe("candidate constants", () => {
  it("has 15 pipeline stages in board order starting with New", () => {
    expect(PIPELINE_STAGES).toHaveLength(15);
    expect(PIPELINE_STAGES[0].value).toBe("new");
    expect(PIPELINE_STAGES[PIPELINE_STAGES.length - 1].value).toBe("hold");
  });

  it("has 4 selectable statuses in the UI dropdown", () => {
    expect(STATUS_OPTIONS).toHaveLength(4);
  });

  it("labels stages and statuses for display", () => {
    expect(stageLabel("interview_r1")).toBe("Interview R1");
    expect(stageLabel("resume_received")).toBe("Resume Received");
    expect(statusLabel("placed")).toBe("Placed");
  });

  it("maps statuses to semantic badge classes", () => {
    expect(statusBadgeClass("placed")).toContain("bg-primary");
    expect(statusBadgeClass("rejected")).toContain("bg-destructive");
    expect(statusBadgeClass("available")).toContain("bg-success");
  });
});

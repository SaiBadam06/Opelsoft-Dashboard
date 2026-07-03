import { describe, it, expect } from "vitest";
import {
  REQUIREMENT_STATUSES,
  SUBMISSION_STATUSES,
  requirementStatusLabel,
  submissionStatusLabel,
  priorityBadgeClass,
} from "@/lib/job-constants";

describe("job constants", () => {
  it("has requirement and submission statuses", () => {
    expect(REQUIREMENT_STATUSES).toHaveLength(4);
    expect(SUBMISSION_STATUSES).toHaveLength(11);
  });
  it("labels enums", () => {
    expect(requirementStatusLabel("on_hold")).toBe("On Hold");
    expect(submissionStatusLabel("interview_scheduled")).toBe(
      "Interview Scheduled",
    );
  });
  it("maps priority to semantic badge class", () => {
    expect(priorityBadgeClass("urgent")).toContain("bg-destructive");
    expect(priorityBadgeClass("low")).toContain("bg-muted");
  });
});

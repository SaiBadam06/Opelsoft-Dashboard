export type InterviewResult =
  | "scheduled"
  | "pending"
  | "passed"
  | "failed"
  | "cancelled";
export type PlacementStatus = "active" | "completed" | "terminated";
export type TaskType =
  | "call"
  | "follow_up"
  | "schedule_interview"
  | "collect_documents"
  | "send_resume"
  | "offer_discussion"
  | "other";
export type TaskStatus = "pending" | "done";

export interface Opt<T extends string> {
  value: T;
  label: string;
}

export const INTERVIEW_RESULTS: Opt<InterviewResult>[] = [
  { value: "scheduled", label: "Scheduled" },
  { value: "pending", label: "Pending" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

export const INTERVIEW_MODES: string[] = ["Phone", "Video", "Onsite"];

export const PLACEMENT_STATUSES: Opt<PlacementStatus>[] = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "terminated", label: "Terminated" },
];

export const TASK_TYPES: Opt<TaskType>[] = [
  { value: "call", label: "Call Candidate" },
  { value: "follow_up", label: "Follow-up" },
  { value: "schedule_interview", label: "Schedule Interview" },
  { value: "collect_documents", label: "Collect Documents" },
  { value: "send_resume", label: "Send Resume" },
  { value: "offer_discussion", label: "Offer Discussion" },
  { value: "other", label: "Other" },
];

export const TASK_STATUSES: Opt<TaskStatus>[] = [
  { value: "pending", label: "Pending" },
  { value: "done", label: "Done" },
];

export const NEW_EXP_OPTIONS: string[] = ["New", "Exp"];
export const IN_OUT_OPTIONS: string[] = ["In", "Out"];

function lab<T extends string>(opts: Opt<T>[], v: T): string {
  return opts.find((o) => o.value === v)?.label ?? v;
}

export const interviewResultLabel = (v: InterviewResult) =>
  lab(INTERVIEW_RESULTS, v);
export const placementStatusLabel = (v: PlacementStatus) =>
  lab(PLACEMENT_STATUSES, v);
export const taskTypeLabel = (v: TaskType) => lab(TASK_TYPES, v);
export const taskStatusLabel = (v: TaskStatus) => lab(TASK_STATUSES, v);

export function interviewResultBadgeClass(r: InterviewResult): string {
  switch (r) {
    case "scheduled":
      return "bg-info text-info-foreground";
    case "pending":
      return "bg-warning text-warning-foreground";
    case "passed":
      return "bg-success text-success-foreground";
    case "failed":
      return "bg-destructive text-white";
    case "cancelled":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function placementStatusBadgeClass(s: PlacementStatus): string {
  switch (s) {
    case "active":
      return "bg-success text-success-foreground";
    case "completed":
      return "bg-primary text-primary-foreground";
    case "terminated":
      return "bg-destructive text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function taskStatusBadgeClass(s: TaskStatus): string {
  return s === "done"
    ? "bg-success text-success-foreground"
    : "bg-warning text-warning-foreground";
}

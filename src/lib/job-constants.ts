export type RequirementPriority = "low" | "medium" | "high" | "urgent";
export type RequirementStatus = "open" | "on_hold" | "filled" | "closed";
export type SubmissionStatus =
  | "matched"
  | "rtr_requested"
  | "rtr_received"
  | "submitted"
  | "client_review"
  | "interview_requested"
  | "interview_scheduled"
  | "selected"
  | "rejected"
  | "on_hold"
  | "placed";
export type PrimeLayer = "prime" | "layer";

export interface Opt<T extends string> {
  value: T;
  label: string;
}

export const REQUIREMENT_PRIORITIES: Opt<RequirementPriority>[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export const REQUIREMENT_STATUSES: Opt<RequirementStatus>[] = [
  { value: "open", label: "Open" },
  { value: "on_hold", label: "On Hold" },
  { value: "filled", label: "Filled" },
  { value: "closed", label: "Closed" },
];

// Pipeline order — matches the submission lifecycle.
export const SUBMISSION_STATUSES: Opt<SubmissionStatus>[] = [
  { value: "matched", label: "Matched" },
  { value: "rtr_requested", label: "RTR Requested" },
  { value: "rtr_received", label: "RTR Received" },
  { value: "submitted", label: "Submitted" },
  { value: "client_review", label: "Client Review" },
  { value: "interview_requested", label: "Interview Requested" },
  { value: "interview_scheduled", label: "Interview Scheduled" },
  { value: "selected", label: "Selected" },
  { value: "rejected", label: "Rejected" },
  { value: "on_hold", label: "On Hold" },
  { value: "placed", label: "Placed" },
];

export const PRIME_LAYERS: Opt<PrimeLayer>[] = [
  { value: "prime", label: "Prime" },
  { value: "layer", label: "Layer" },
];

export const EMPLOYMENT_TYPES: string[] = [
  "C2C",
  "W2",
  "1099",
  "Full-time",
  "Contract",
  "Contract-to-hire",
];

function labelFrom<T extends string>(opts: Opt<T>[], v: T): string {
  return opts.find((o) => o.value === v)?.label ?? v;
}

export const requirementStatusLabel = (v: RequirementStatus) =>
  labelFrom(REQUIREMENT_STATUSES, v);
export const requirementPriorityLabel = (v: RequirementPriority) =>
  labelFrom(REQUIREMENT_PRIORITIES, v);
export const submissionStatusLabel = (v: SubmissionStatus) =>
  labelFrom(SUBMISSION_STATUSES, v);

export function requirementStatusBadgeClass(s: RequirementStatus): string {
  switch (s) {
    case "open":
      return "bg-success text-success-foreground";
    case "on_hold":
      return "bg-warning text-warning-foreground";
    case "filled":
      return "bg-primary text-primary-foreground";
    case "closed":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function priorityBadgeClass(p: RequirementPriority): string {
  switch (p) {
    case "urgent":
      return "bg-destructive text-white";
    case "high":
      return "bg-warning text-warning-foreground";
    case "medium":
      return "bg-info text-info-foreground";
    case "low":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function submissionStatusBadgeClass(s: SubmissionStatus): string {
  switch (s) {
    case "matched":
      return "bg-muted text-muted-foreground";
    case "rtr_requested":
    case "rtr_received":
    case "submitted":
      return "bg-info text-info-foreground";
    case "client_review":
    case "interview_requested":
    case "interview_scheduled":
      return "bg-warning text-warning-foreground";
    case "selected":
      return "bg-success text-success-foreground";
    case "placed":
      return "bg-primary text-primary-foreground";
    case "rejected":
      return "bg-destructive text-white";
    case "on_hold":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

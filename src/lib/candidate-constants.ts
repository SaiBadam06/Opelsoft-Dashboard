export type CandidateStatus =
  | "available"
  | "interviewing"
  | "submitted"
  | "offered"
  | "placed"
  | "rejected"
  | "inactive";

export type PipelineStage =
  | "new"
  | "contacted"
  | "interested"
  | "resume_received"
  | "screening"
  | "matched"
  | "submitted"
  | "interview_r1"
  | "interview_r2"
  | "final_interview"
  | "offer_released"
  | "offer_accepted"
  | "placed"
  | "rejected"
  | "hold";

export interface Option<T extends string> {
  value: T;
  label: string;
}

export const STATUS_OPTIONS: Option<CandidateStatus>[] = [
  { value: "available", label: "Available" },
  { value: "interviewing", label: "Interviewing" },
  { value: "submitted", label: "Submitted" },
  { value: "offered", label: "Offered" },
  { value: "placed", label: "Placed" },
  { value: "rejected", label: "Rejected" },
  { value: "inactive", label: "Inactive" },
];

// Jira-style board order
export const PIPELINE_STAGES: Option<PipelineStage>[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "interested", label: "Interested" },
  { value: "resume_received", label: "Resume Received" },
  { value: "screening", label: "Screening" },
  { value: "matched", label: "Matched" },
  { value: "submitted", label: "Submitted" },
  { value: "interview_r1", label: "Interview R1" },
  { value: "interview_r2", label: "Interview R2" },
  { value: "final_interview", label: "Final Interview" },
  { value: "offer_released", label: "Offer Released" },
  { value: "offer_accepted", label: "Offer Accepted" },
  { value: "placed", label: "Placed" },
  { value: "rejected", label: "Rejected" },
  { value: "hold", label: "Hold" },
];

export const VISA_OPTIONS: string[] = [
  "H1B",
  "H4 EAD",
  "OPT",
  "CPT",
  "GC",
  "GC EAD",
  "USC",
  "TN",
  "L2 EAD",
  "Other",
];

const STAGE_LABELS: Record<PipelineStage, string> = PIPELINE_STAGES.reduce(
  (acc, s) => {
    acc[s.value] = s.label;
    return acc;
  },
  {} as Record<PipelineStage, string>,
);

export function stageLabel(stage: PipelineStage): string {
  return STAGE_LABELS[stage] ?? stage;
}

const STATUS_LABELS: Record<CandidateStatus, string> = STATUS_OPTIONS.reduce(
  (acc, s) => {
    acc[s.value] = s.label;
    return acc;
  },
  {} as Record<CandidateStatus, string>,
);

export function statusLabel(status: CandidateStatus): string {
  return STATUS_LABELS[status] ?? status;
}

// Map a status to a semantic-token Badge className.
export function statusBadgeClass(status: CandidateStatus): string {
  switch (status) {
    case "available":
      return "bg-success text-success-foreground";
    case "interviewing":
    case "submitted":
      return "bg-info text-info-foreground";
    case "offered":
      return "bg-warning text-warning-foreground";
    case "placed":
      return "bg-primary text-primary-foreground";
    case "rejected":
      return "bg-destructive text-white";
    case "inactive":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

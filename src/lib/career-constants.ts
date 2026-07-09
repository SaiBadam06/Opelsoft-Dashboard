export type JobPostingStatus = "draft" | "published" | "closed";
export type WorkplaceType = "remote" | "hybrid" | "onsite";
export type JobApplicationStatus =
  | "new"
  | "reviewing"
  | "shortlisted"
  | "rejected"
  | "converted";

export interface Opt<T extends string> {
  value: T;
  label: string;
}

export const JOB_POSTING_STATUSES: Opt<JobPostingStatus>[] = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "closed", label: "Closed" },
];

export const WORKPLACE_TYPES: Opt<WorkplaceType>[] = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

export const JOB_APPLICATION_STATUSES: Opt<JobApplicationStatus>[] = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "rejected", label: "Rejected" },
  { value: "converted", label: "In candidate pool" },
];

function labelFrom<T extends string>(opts: Opt<T>[], v: T): string {
  return opts.find((o) => o.value === v)?.label ?? v;
}

export const workplaceTypeLabel = (v: WorkplaceType) =>
  labelFrom(WORKPLACE_TYPES, v);

export function workplaceBadgeClass(w: WorkplaceType): string {
  switch (w) {
    case "remote":
      return "bg-success/15 text-success";
    case "hybrid":
      return "bg-info/15 text-info";
    case "onsite":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export const applicationStatusLabel = (v: JobApplicationStatus) =>
  labelFrom(JOB_APPLICATION_STATUSES, v);

export function applicationStatusBadgeClass(
  s: JobApplicationStatus,
): string {
  switch (s) {
    case "new":
      return "bg-primary/15 text-primary";
    case "reviewing":
      return "bg-info/15 text-info";
    case "shortlisted":
      return "bg-success/15 text-success";
    case "rejected":
      return "bg-destructive/15 text-destructive";
    case "converted":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

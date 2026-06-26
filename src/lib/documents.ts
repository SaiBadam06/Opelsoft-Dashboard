export type DocumentType =
  | "resume"
  | "cover_letter"
  | "certificate"
  | "work_auth"
  | "driving_licence"
  | "other";

export interface CandidateDocument {
  id: string;
  candidate_id: string;
  type: DocumentType;
  file_name: string;
  storage_path: string;
  size_bytes: number | null;
  created_at: string;
}

export const DOCUMENT_BUCKET = "candidate-docs";

export const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: "resume", label: "Resume" },
  { value: "cover_letter", label: "Cover Letter" },
  { value: "certificate", label: "Certificate" },
  { value: "work_auth", label: "Work Auth Card" },
  { value: "driving_licence", label: "Driving Licence" },
  { value: "other", label: "Other" },
];

export function documentTypeLabel(t: DocumentType): string {
  return DOCUMENT_TYPES.find((d) => d.value === t)?.label ?? t;
}

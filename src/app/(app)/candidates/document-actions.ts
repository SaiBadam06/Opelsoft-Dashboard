"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { DOCUMENT_BUCKET, type DocumentType, type CandidateDocument } from "@/lib/documents";

const VALID_TYPES: DocumentType[] = [
  "resume",
  "cover_letter",
  "certificate",
  "work_auth",
  "driving_licence",
  "other",
];

// Records a document row after the file has been uploaded to storage (client).
export async function recordDocument(input: {
  candidateId: string;
  type: string;
  fileName: string;
  storagePath: string;
  sizeBytes: number;
}) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const type = (VALID_TYPES as string[]).includes(input.type)
    ? (input.type as DocumentType)
    : "other";

  const supabase = await createClient();
  const { error } = await supabase.from("documents").insert({
    candidate_id: input.candidateId,
    type,
    file_name: input.fileName,
    storage_path: input.storagePath,
    size_bytes: input.sizeBytes,
    uploaded_by: me.id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/candidates/${input.candidateId}`);
  return { ok: true as const };
}

export async function deleteDocument(
  id: string,
  candidateId: string,
  storagePath: string,
) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const supabase = await createClient();
  await supabase.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/candidates/${candidateId}`);
  return { ok: true as const };
}

// Returns a short-lived signed URL for downloading a private document.
export async function getDocumentUrl(storagePath: string) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(storagePath, 60 * 10);
  if (error || !data) return { error: error?.message ?? "Could not sign URL" };
  return { ok: true as const, url: data.signedUrl };
}

export async function listDocuments(
  candidateId: string,
): Promise<CandidateDocument[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select(
      "id, candidate_id, type, file_name, storage_path, size_bytes, created_at",
    )
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });
  return (data as CandidateDocument[] | null) ?? [];
}

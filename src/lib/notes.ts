import { createClient } from "@/lib/supabase/server";

export interface Note {
  id: string;
  candidate_id: string | null;
  requirement_id: string | null;
  submission_id: string | null;
  vendor_id: string | null;
  author_id: string | null;
  author_name: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type EntityType = "candidate" | "requirement" | "submission" | "vendor";

function getEntityColumn(entityType: EntityType): string {
  switch (entityType) {
    case "candidate":
      return "candidate_id";
    case "requirement":
      return "requirement_id";
    case "submission":
      return "submission_id";
    case "vendor":
      return "vendor_id";
  }
}

export async function listNotes(
  entityType: EntityType,
  entityId: string,
): Promise<Note[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notes")
    .select("*")
    .eq(getEntityColumn(entityType), entityId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (data as Note[] | null) ?? [];
}

export async function addNote(
  entityType: EntityType,
  entityId: string,
  content: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const { error } = await supabase.from("notes").insert({
    [getEntityColumn(entityType)]: entityId,
    content,
    author_id: user.id,
    author_name: profile?.full_name ?? null,
  });

  if (error) throw error;
}

export async function updateNote(id: string, content: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notes")
    .update({ content })
    .eq("id", id);
  if (error) throw error;
}

export async function softDeleteNote(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function hardDeleteNote(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}

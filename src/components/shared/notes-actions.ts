"use server";

import { revalidatePath } from "next/cache";
import { addNote, updateNote, softDeleteNote, hardDeleteNote, type EntityType } from "@/lib/notes";
import { getCurrentProfile } from "@/lib/auth";

export async function addNoteAction(entityType: EntityType, entityId: string, content: string, path: string) {
  if (!content.trim()) return;
  await addNote(entityType, entityId, content);
  revalidatePath(path);
}

export async function updateNoteAction(noteId: string, content: string, path: string) {
  if (!content.trim()) return;
  await updateNote(noteId, content);
  revalidatePath(path);
}

export async function deleteNoteAction(noteId: string, path: string) {
  const profile = await getCurrentProfile();
  if (profile?.role === "admin") {
    await hardDeleteNote(noteId);
  } else {
    await softDeleteNote(noteId);
  }
  revalidatePath(path);
}

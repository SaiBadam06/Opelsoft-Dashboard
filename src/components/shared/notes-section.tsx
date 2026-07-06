"use client";

import { useState } from "react";
import { type Note, type EntityType } from "@/lib/notes";
import { type Role } from "@/lib/roles";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addNoteAction, updateNoteAction, deleteNoteAction } from "./notes-actions";
import { usePathname } from "next/navigation";
import { Pencil, Trash2, X, Check } from "lucide-react";

function NoteItem({ note, currentUserRole, currentUserId, path }: { note: Note, currentUserRole: Role, currentUserId: string, path: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canEdit = note.author_id === currentUserId;
  const canDelete = currentUserRole === "admin" || note.author_id === currentUserId;

  const handleUpdate = async () => {
    setIsSubmitting(true);
    try {
      await updateNoteAction(note.id, content, path);
      setIsEditing(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this note?")) return;
    setIsSubmitting(true);
    try {
      await deleteNoteAction(note.id, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm bg-card shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{note.author_name || "Unknown User"}</span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {note.updated_at !== note.created_at ? (
            <span title={formatDateTime(note.updated_at)} className="italic">
              (edited)
            </span>
          ) : null}
          <span>{formatDateTime(note.created_at)}</span>
          
          <div className="flex items-center gap-1 ml-2">
            {canEdit && !isEditing && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => setIsEditing(true)}>
                <Pencil className="h-3 w-3" />
              </Button>
            )}
            {canDelete && !isEditing && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={handleDelete} disabled={isSubmitting}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {isEditing ? (
        <div className="flex flex-col gap-2 mt-1">
          <Textarea 
            value={content} 
            onChange={(e) => setContent(e.target.value)} 
            className="min-h-[80px] text-sm"
            disabled={isSubmitting}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setContent(note.content); }} disabled={isSubmitting}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button variant="default" size="sm" onClick={handleUpdate} disabled={isSubmitting || !content.trim()}>
              <Check className="h-4 w-4 mr-1" /> Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap mt-1 text-card-foreground/90 leading-relaxed">{note.content}</p>
      )}
    </div>
  );
}

export function NotesSection({
  notes,
  entityType,
  entityId,
  currentUserRole,
  currentUserId,
}: {
  notes: Note[];
  entityType: EntityType;
  entityId: string;
  currentUserRole: Role;
  currentUserId: string;
}) {
  const [newNote, setNewNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const path = usePathname();

  const handleAdd = async () => {
    setIsSubmitting(true);
    try {
      await addNoteAction(entityType, entityId, newNote, path);
      setNewNote("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No notes added yet.</p>
        ) : (
          notes.map((note) => (
            <NoteItem 
              key={note.id} 
              note={note} 
              currentUserRole={currentUserRole} 
              currentUserId={currentUserId}
              path={path}
            />
          ))
        )}
      </div>
      
      <div className="flex flex-col gap-2 mt-2 pt-4 border-t">
        <Textarea
          placeholder="Add a new note..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          className="min-h-[80px] text-sm resize-y"
          disabled={isSubmitting}
        />
        <div className="flex justify-end">
          <Button onClick={handleAdd} disabled={isSubmitting || !newNote.trim()}>
            Add Note
          </Button>
        </div>
      </div>
    </div>
  );
}

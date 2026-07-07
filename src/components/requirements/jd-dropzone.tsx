"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { parseJdDocument } from "@/app/(app)/requirements/jd-parse-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function JdDropzone({
  notesFieldId = "notes",
}: {
  notesFieldId?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pending, startTransition] = useTransition();

  function fillNotes(text: string) {
    const el = document.getElementById(notesFieldId) as HTMLTextAreaElement | null;
    if (el) {
      el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await parseJdDocument(fd);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      fillNotes(res.text);
      toast.success("JD imported into notes field");
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFile(e.target.files?.[0]);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Import JD (PDF or Word)</Label>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
        )}
      >
        {pending ? (
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        ) : (
          <FileText className="size-8 text-muted-foreground" />
        )}
        <p className="font-medium">
          Drop a JD file here or click to browse
        </p>
        <p className="text-xs text-muted-foreground">
          PDF, .doc, or .docx — fills the JD notes field below
        </p>
        <Button type="button" variant="outline" size="sm" disabled={pending}>
          <Upload />
          Choose file
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={onInputChange}
        />
      </div>
    </div>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  DOCUMENT_BUCKET,
  DOCUMENT_TYPES,
  documentTypeLabel,
  type CandidateDocument,
  type DocumentType,
} from "@/lib/documents";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  recordDocument,
  deleteDocument,
  getDocumentUrl,
} from "@/app/(app)/candidates/document-actions";

export function DocumentsTab({
  candidateId,
  documents,
}: {
  candidateId: string;
  documents: CandidateDocument[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<DocumentType>(DOCUMENT_TYPES[0].value);
  const [uploading, setUploading] = useState(false);

  async function onUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a file to upload.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${candidateId}/${Date.now()}-${safeName}`;

      const { error } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .upload(path, file);
      if (error) {
        toast.error(error.message);
        return;
      }

      const res = await recordDocument({
        candidateId,
        type,
        fileName: file.name,
        storagePath: path,
        sizeBytes: file.size,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }

      toast.success("Document uploaded");
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        {/* Upload row */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as DocumentType)}
            disabled={uploading}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {DOCUMENT_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <Input
            ref={fileInputRef}
            type="file"
            disabled={uploading}
            className="w-full sm:w-auto"
          />
          <Button onClick={onUpload} disabled={uploading}>
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
            Upload
          </Button>
        </div>

        {/* Document list */}
        {documents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <FileText className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No documents yet — upload a resume or certificate above.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {documents.map((doc) => (
              <DocumentRow key={doc.id} candidateId={candidateId} doc={doc} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DocumentRow({
  candidateId,
  doc,
}: {
  candidateId: string;
  doc: CandidateDocument;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function onDownload() {
    const res = await getDocumentUrl(doc.storage_path);
    if ("url" in res) {
      window.open(res.url, "_blank");
    } else {
      toast.error(res.error);
    }
  }

  function onDelete() {
    startTransition(async () => {
      const res = await deleteDocument(doc.id, candidateId, doc.storage_path);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Document deleted");
      router.refresh();
    });
  }

  const sizeKb = Math.round((doc.size_bytes ?? 0) / 1024);

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-md border p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{doc.file_name}</span>
          <Badge variant="outline">{documentTypeLabel(doc.type)}</Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {sizeKb} KB · {formatDate(doc.created_at)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onDownload}>
          <Download />
          Download
        </Button>
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button variant="ghost" size="sm" className="text-destructive">
                <Trash2 />
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete document?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes “{doc.file_name}”. This cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={pending}
                onClick={onDelete}
                className={cn(
                  "bg-destructive text-white hover:bg-destructive/90",
                )}
              >
                {pending ? <Loader2 className="animate-spin" /> : null}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}

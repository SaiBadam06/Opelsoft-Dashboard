"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, Upload, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Candidate } from "@/lib/candidates";
import {
  STATUS_OPTIONS,
  PIPELINE_STAGES,
  VISA_OPTIONS,
} from "@/lib/candidate-constants";
import {
  createCandidateReturningId,
  updateCandidate,
} from "@/app/(app)/candidates/actions";
import { parseResumeAction, saveResumeParseAction } from "@/app/(app)/candidates/parse-actions";
import { recordDocument } from "@/app/(app)/candidates/document-actions";
import { DocumentTypeBar } from "@/app/(app)/candidates/document-type-bar";
import { DOCUMENT_BUCKET, documentTypeLabel, type DocumentType } from "@/lib/documents";
import { createClient } from "@/lib/supabase/client";
import type { GitHubRepo, ParsedResume } from "@/lib/parsing/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const selectClassName = "h-9 rounded-md border bg-background px-3 text-sm";

export function CandidateForm({ candidate }: { candidate?: Candidate }) {
  const isEdit = Boolean(candidate);
  const router = useRouter();

  // Edit path keeps the server-action form; create path is handled client-side.
  const [editState, editAction, editPending] = useActionState(updateCandidate, null);
  const [createPending, setCreatePending] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Autofill state (create mode only).
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<DocumentType>("resume");
  const [autofilling, setAutofilling] = useState(false);
  const [prefill, setPrefill] = useState<Record<string, string>>({});
  const [prefillKey, setPrefillKey] = useState(0);
  const [files, setFiles] = useState<Partial<Record<DocumentType, File>>>({});
  const [parsedData, setParsedData] = useState<{
    parsed: ParsedResume;
    githubRepos: GitHubRepo[];
  } | null>(null);

  const pending = isEdit ? editPending : createPending;
  const error = createError ?? editState?.error ?? null;

  // Field default: parsed prefill wins, then the existing candidate, then blank.
  const def = (key: keyof Candidate, prefillKeyName?: string) => {
    const pk = prefillKeyName ?? key;
    return prefill[pk] ?? (candidate?.[key] as string | number | null | undefined) ?? "";
  };

  // Store the picked file under the active type; reset the native input so the same
  // tab can be re-picked and switching tabs shows a clean input.
  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setFiles((m) => ({ ...m, [docType]: f }));
    e.target.value = "";
  }

  function removeFile(type: DocumentType) {
    setFiles((m) => {
      const next = { ...m };
      delete next[type];
      return next;
    });
    if (type === "resume") setParsedData(null); // parse is meaningless without its resume
  }

  async function onAutofill() {
    const file = files.resume ?? null;
    if (!file) {
      toast.error("Choose a resume file on the Resume tab first.");
      return;
    }
    setAutofilling(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await parseResumeAction(fd);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setParsedData({ parsed: res.parsed, githubRepos: res.githubRepos });
      setPrefill(res.fields);
      setPrefillKey((k) => k + 1); // remount fields so defaultValues pick up the parse
      toast.success("Form filled from resume — review, edit, then save.");
    } finally {
      setAutofilling(false);
    }
  }

  async function onCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);
    const fd = new FormData(e.currentTarget);
    if (!String(fd.get("full_name") ?? "").trim()) {
      setCreateError("Name is required.");
      return;
    }
    setCreatePending(true);
    try {
      const res = await createCandidateReturningId(fd);
      if ("error" in res) {
        setCreateError(res.error);
        return;
      }
      const id = res.id;

      const attached = Object.entries(files) as [DocumentType, File][];
      if (attached.length) {
        const supabase = createClient();
        const uploadFailures: string[] = [];
        for (const [type, file] of attached) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `${id}/${Date.now()}-${type}-${safeName}`; // type keeps paths unique per doc
          const up = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, file);
          if (up.error) {
            uploadFailures.push(documentTypeLabel(type));
            continue;
          }
          await recordDocument({
            candidateId: id,
            type,
            fileName: file.name,
            storagePath: path,
            sizeBytes: file.size,
          });
        }
        if (uploadFailures.length) {
          toast.error(
            `Candidate saved, but these uploads failed: ${uploadFailures.join(", ")}. Re-upload from the Documents tab.`,
          );
        }
        if (files.resume && parsedData) {
          // Don't swallow the result: a failed persist means no skill-search row.
          const parseRes = await saveResumeParseAction(id, parsedData.parsed, parsedData.githubRepos);
          if (parseRes && "error" in parseRes) {
            toast.error(
              `Candidate saved, but parsed skills weren't stored (${parseRes.error}). They won't appear in skill search until you re-run Autofill.`,
            );
          }
        }
      }
      router.push(`/candidates/${id}`);
    } finally {
      setCreatePending(false);
    }
  }

  return (
    <form
      action={isEdit ? editAction : undefined}
      onSubmit={isEdit ? undefined : onCreateSubmit}
      className="flex flex-col gap-6"
    >
      {candidate ? <input type="hidden" name="id" value={candidate.id} /> : null}

      {/* Autofill (create mode only) */}
      {!isEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Autofill from resume</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <DocumentTypeBar value={docType} onChange={setDocType} disabled={autofilling} />
            <div className="flex flex-wrap items-center gap-3">
              <Input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.txt"
                disabled={autofilling}
                onChange={onPickFile}
                className="w-full sm:w-auto"
              />
              {docType === "resume" ? (
                <Button type="button" variant="secondary" onClick={onAutofill} disabled={autofilling}>
                  {autofilling ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  Autofill
                </Button>
              ) : null}
              {files[docType] ? (
                <span className="text-xs text-muted-foreground">
                  <Upload className="mr-1 inline size-3" />
                  {files[docType]!.name}
                </span>
              ) : null}
            </div>

            {Object.keys(files).length ? (
              <ul className="flex flex-col gap-1 rounded-md border bg-muted/30 p-2 text-xs">
                {(Object.entries(files) as [DocumentType, File][]).map(([type, file]) => (
                  <li key={type} className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      <span className="text-muted-foreground">{documentTypeLabel(type)}:</span>{" "}
                      {file.name}
                      {type === "resume" && parsedData ? " (parsed)" : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(type)}
                      disabled={autofilling}
                      aria-label={`Remove ${documentTypeLabel(type)}`}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Pick a document type, choose a file, and it attaches on Save. On the{" "}
              <strong>Resume</strong> tab, click <strong>Autofill</strong> to fill the form from
              the resume. All attached files are saved with the candidate.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Remount the field groups when a parse arrives so defaultValues update. */}
      <div key={prefillKey} className="contents">
        {/* Personal */}
        <Card>
          <CardHeader>
            <CardTitle>Personal</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="full_name">
                Full name <span className="text-destructive">*</span>
              </Label>
              <Input id="full_name" name="full_name" required defaultValue={def("full_name")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={def("email")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={def("phone")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" defaultValue={def("location")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="experience_years">Experience (years)</Label>
              <Input
                id="experience_years"
                name="experience_years"
                type="number"
                step={0.5}
                defaultValue={def("experience_years")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="current_company">Current company</Label>
              <Input id="current_company" name="current_company" defaultValue={def("current_company")} />
            </div>
          </CardContent>
        </Card>

        {/* Bench sales */}
        <Card>
          <CardHeader>
            <CardTitle>Bench sales</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rate">Rate ($/hr)</Label>
              <Input id="rate" name="rate" type="number" defaultValue={def("rate")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="visa">Visa</Label>
              <select id="visa" name="visa" className={selectClassName} defaultValue={def("visa")}>
                <option value="" />
                {VISA_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="relocation">Relocation</Label>
              <Input id="relocation" name="relocation" defaultValue={def("relocation")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="availability">Availability</Label>
              <Input id="availability" name="availability" defaultValue={def("availability")} />
            </div>
          </CardContent>
        </Card>

        {/* Professional */}
        <Card>
          <CardHeader>
            <CardTitle>Professional</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="primary_skills">Primary skills</Label>
              <Input id="primary_skills" name="primary_skills" defaultValue={def("primary_skills")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="secondary_skills">Secondary skills</Label>
              <Input id="secondary_skills" name="secondary_skills" defaultValue={def("secondary_skills")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="certifications">Certifications</Label>
              <Input id="certifications" name="certifications" defaultValue={def("certifications")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="education">Education</Label>
              <Input id="education" name="education" defaultValue={def("education")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="preferred_location">Preferred location</Label>
              <Input id="preferred_location" name="preferred_location" defaultValue={def("preferred_location")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="linkedin">LinkedIn</Label>
              <Input id="linkedin" name="linkedin" defaultValue={def("linkedin")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="github">GitHub</Label>
              <Input id="github" name="github" defaultValue={def("github")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="portfolio">Portfolio</Label>
              <Input id="portfolio" name="portfolio" defaultValue={def("portfolio")} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="projects">Projects</Label>
              <Textarea id="projects" name="projects" defaultValue={def("projects")} />
            </div>
          </CardContent>
        </Card>

        {/* Status & pipeline */}
        <Card>
          <CardHeader>
            <CardTitle>Status &amp; pipeline</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                className={selectClassName}
                defaultValue={candidate?.status ?? "available"}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pipeline_stage">Pipeline stage</Label>
              <select
                id="pipeline_stage"
                name="pipeline_stage"
                className={selectClassName}
                defaultValue={candidate?.pipeline_stage ?? "new"}
              >
                {PIPELINE_STAGES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="visa_transfer"
                name="visa_transfer"
                type="checkbox"
                defaultChecked={candidate?.visa_transfer}
                className="size-4 rounded border accent-primary"
              />
              <Label htmlFor="visa_transfer">H1B/visa transfer (H1T)</Label>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" defaultValue={def("notes")} />
            </div>
          </CardContent>
        </Card>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          render={<Link href={candidate ? `/candidates/${candidate.id}` : "/candidates"} />}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className={cn("animate-spin")} />
              Saving…
            </>
          ) : (
            "Save candidate"
          )}
        </Button>
      </div>
    </form>
  );
}

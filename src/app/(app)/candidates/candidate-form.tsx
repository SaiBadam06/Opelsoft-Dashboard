"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { Candidate } from "@/lib/candidates";
import {
  STATUS_OPTIONS,
  PIPELINE_STAGES,
  VISA_OPTIONS,
} from "@/lib/candidate-constants";
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/documents";
import { DocumentTypeBar } from "@/app/(app)/candidates/document-type-bar";
import { autofillFromDocuments } from "@/app/(app)/candidates/parse-actions";
import { createCandidate, updateCandidate } from "@/app/(app)/candidates/actions";
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

const selectClassName =
  "h-9 rounded-md border bg-background px-3 text-sm";

export function CandidateForm({ candidate }: { candidate?: Candidate }) {
  const action = candidate ? updateCandidate : createCandidate;
  const [state, formAction, pending] = useActionState(action, null);

  const isCreate = !candidate;
  const formRef = useRef<HTMLFormElement>(null);
  const [activeType, setActiveType] = useState<DocumentType>(
    DOCUMENT_TYPES[0].value,
  );
  const [autofilling, setAutofilling] = useState(false);

  // Parse every attached document and fill only the fields the user left blank.
  async function onAutofill() {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData();
    let any = false;
    for (const d of DOCUMENT_TYPES) {
      const input = form.elements.namedItem(
        `doc_${d.value}`,
      ) as HTMLInputElement | null;
      for (const file of input?.files ?? []) {
        fd.append(`doc_${d.value}`, file);
        any = true;
      }
    }
    if (!any) {
      toast.error("Attach a document first.");
      return;
    }
    setAutofilling(true);
    try {
      const { fields, resumeParsed, errors } =
        await autofillFromDocuments(fd);
      for (const [name, value] of Object.entries(fields)) {
        const el = form.elements.namedItem(name) as
          | HTMLInputElement
          | HTMLTextAreaElement
          | null;
        if (el && !el.value && value) el.value = value;
      }
      const hidden = form.elements.namedItem(
        "resume_parsed",
      ) as HTMLInputElement | null;
      if (hidden && resumeParsed) hidden.value = JSON.stringify(resumeParsed);
      errors.forEach((e) => toast.error(e));
      toast.success("Autofilled from documents — review before saving.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAutofilling(false);
    }
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-6">
      {candidate ? (
        <input type="hidden" name="id" value={candidate.id} />
      ) : null}

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
            <Input
              id="full_name"
              name="full_name"
              required
              defaultValue={candidate?.full_name ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={candidate?.email ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              defaultValue={candidate?.phone ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              defaultValue={candidate?.location ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="experience_years">Experience (years)</Label>
            <Input
              id="experience_years"
              name="experience_years"
              type="number"
              step={0.5}
              defaultValue={candidate?.experience_years ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="current_company">Current company</Label>
            <Input
              id="current_company"
              name="current_company"
              defaultValue={candidate?.current_company ?? ""}
            />
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
            <Input
              id="rate"
              name="rate"
              type="number"
              defaultValue={candidate?.rate ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="visa">Visa</Label>
            <select
              id="visa"
              name="visa"
              className={selectClassName}
              defaultValue={candidate?.visa ?? ""}
            >
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
            <Input
              id="relocation"
              name="relocation"
              defaultValue={candidate?.relocation ?? ""}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="availability">Availability</Label>
            <Input
              id="availability"
              name="availability"
              defaultValue={candidate?.availability ?? ""}
            />
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
            <Input
              id="primary_skills"
              name="primary_skills"
              defaultValue={candidate?.primary_skills ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="secondary_skills">Secondary skills</Label>
            <Input
              id="secondary_skills"
              name="secondary_skills"
              defaultValue={candidate?.secondary_skills ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="certifications">Certifications</Label>
            <Input
              id="certifications"
              name="certifications"
              defaultValue={candidate?.certifications ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="education">Education</Label>
            <Input
              id="education"
              name="education"
              defaultValue={candidate?.education ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preferred_location">Preferred location</Label>
            <Input
              id="preferred_location"
              name="preferred_location"
              defaultValue={candidate?.preferred_location ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="linkedin">LinkedIn</Label>
            <Input
              id="linkedin"
              name="linkedin"
              defaultValue={candidate?.linkedin ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="github">GitHub</Label>
            <Input
              id="github"
              name="github"
              defaultValue={candidate?.github ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="portfolio">Portfolio</Label>
            <Input
              id="portfolio"
              name="portfolio"
              defaultValue={candidate?.portfolio ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="projects">Projects</Label>
            <Textarea
              id="projects"
              name="projects"
              defaultValue={candidate?.projects ?? ""}
            />
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
            <Textarea
              id="notes"
              name="notes"
              defaultValue={candidate?.notes ?? ""}
            />
          </div>
        </CardContent>
      </Card>

      {/* Documents (create only): attach by folder, then autofill from them */}
      {isCreate ? (
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <DocumentTypeBar
              value={activeType}
              onChange={setActiveType}
              disabled={autofilling}
            />
            {DOCUMENT_TYPES.map((d) => (
              <div
                key={d.value}
                className={activeType === d.value ? "block" : "hidden"}
              >
                <Label className="mb-1.5 block">{d.label}</Label>
                <input
                  type="file"
                  name={`doc_${d.value}`}
                  multiple
                  className="text-sm"
                />
              </div>
            ))}
            <input type="hidden" name="resume_parsed" />
            <div>
              <Button
                type="button"
                variant="secondary"
                onClick={onAutofill}
                disabled={autofilling}
              >
                {autofilling ? <Loader2 className="animate-spin" /> : null}
                Autofill from documents
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {state?.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          render={
            <Link
              href={candidate ? `/candidates/${candidate.id}` : "/candidates"}
            />
          }
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

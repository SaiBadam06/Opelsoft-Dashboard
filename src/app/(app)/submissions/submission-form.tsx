"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { PRIME_LAYERS, SUBMISSION_STATUSES } from "@/lib/job-constants";
import { createSubmission } from "@/app/(app)/submissions/actions";
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
import type { VendorOption } from "@/lib/vendors";
import { VendorCombobox } from "./vendor-combobox";

const selectClassName = "h-9 rounded-md border bg-background px-3 text-sm";

export function SubmissionForm({
  candidates,
  requirements,
  vendors,
  today,
  defaultCandidateId,
  defaultRequirementId,
}: {
  candidates: { id: string; full_name: string }[];
  requirements: { id: string; title: string }[];
  vendors: VendorOption[];
  today: string;
  defaultCandidateId?: string;
  defaultRequirementId?: string;
}) {
  const [state, formAction, pending] = useActionState(createSubmission, null);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* Submission */}
      <Card>
        <CardHeader>
          <CardTitle>Submission</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="candidate_id">
              Candidate <span className="text-destructive">*</span>
            </Label>
            <select
              id="candidate_id"
              name="candidate_id"
              required
              className={selectClassName}
              defaultValue={defaultCandidateId ?? ""}
            >
              <option value="" disabled>
                Select a candidate
              </option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="requirement_id">Requirement</Label>
            <select
              id="requirement_id"
              name="requirement_id"
              className={selectClassName}
              defaultValue={defaultRequirementId ?? ""}
            >
              <option value="" />
              {requirements.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vendor_id">Vendor</Label>
            <VendorCombobox vendors={vendors} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="end_client">End client</Label>
            <Input id="end_client" name="end_client" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prime_layer">Prime / Layer</Label>
            <select
              id="prime_layer"
              name="prime_layer"
              className={selectClassName}
              defaultValue=""
            >
              <option value="" />
              {PRIME_LAYERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rate">Rate ($/hr)</Label>
            <Input id="rate" name="rate" type="number" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="submitted_date">Submitted date</Label>
            <Input
              id="submitted_date"
              name="submitted_date"
              type="date"
              defaultValue={today}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resume_version">Resume version</Label>
            <Input id="resume_version" name="resume_version" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              className={selectClassName}
              defaultValue={defaultRequirementId ? "matched" : "submitted"}
            >
              {SUBMISSION_STATUSES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" />
          </div>
        </CardContent>
      </Card>

      {state?.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" render={<Link href="/submissions" />}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className={cn("animate-spin")} />
              Saving…
            </>
          ) : (
            "Save submission"
          )}
        </Button>
      </div>
    </form>
  );
}

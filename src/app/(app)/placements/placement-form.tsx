"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  IN_OUT_OPTIONS,
  NEW_EXP_OPTIONS,
  PLACEMENT_STATUSES,
} from "@/lib/work-constants";
import { createPlacement } from "@/app/(app)/placements/actions";
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

export function PlacementForm({
  candidates,
  vendors,
}: {
  candidates: { id: string; full_name: string }[];
  vendors: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createPlacement, null);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* Placement */}
      <Card>
        <CardHeader>
          <CardTitle>Placement</CardTitle>
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
              defaultValue=""
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
            <Label htmlFor="vendor_id">Vendor</Label>
            <select
              id="vendor_id"
              name="vendor_id"
              className={selectClassName}
              defaultValue=""
            >
              <option value="" />
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="end_client">End client</Label>
            <Input id="end_client" name="end_client" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new_exp">New / Exp</Label>
            <select
              id="new_exp"
              name="new_exp"
              className={selectClassName}
              defaultValue=""
            >
              <option value="" />
              {NEW_EXP_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rate">Rate ($/hr)</Label>
            <Input id="rate" name="rate" type="number" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              className={selectClassName}
              defaultValue="active"
            >
              {PLACEMENT_STATUSES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Dates */}
      <Card>
        <CardHeader>
          <CardTitle>Dates</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="placement_date">Placement date</Label>
            <Input id="placement_date" name="placement_date" type="date" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project_start_date">Project start date</Label>
            <Input
              id="project_start_date"
              name="project_start_date"
              type="date"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bgv_date">BGV date</Label>
            <Input id="bgv_date" name="bgv_date" type="date" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project_end_date">Project end date</Label>
            <Input id="project_end_date" name="project_end_date" type="date" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="in_out">In / Out</Label>
            <select
              id="in_out"
              name="in_out"
              className={selectClassName}
              defaultValue=""
            >
              <option value="" />
              {IN_OUT_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Team */}
      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recruiter">Recruiter</Label>
            <Input id="recruiter" name="recruiter" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="opt_recruiter">OPT recruiter</Label>
            <Input id="opt_recruiter" name="opt_recruiter" />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="feedback">Feedback</Label>
            <Textarea id="feedback" name="feedback" />
          </div>
        </CardContent>
      </Card>

      {state?.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" render={<Link href="/placements" />}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className={cn("animate-spin")} />
              Saving…
            </>
          ) : (
            "Save placement"
          )}
        </Button>
      </div>
    </form>
  );
}

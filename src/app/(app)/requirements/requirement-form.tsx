"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Requirement } from "@/lib/requirements";
import {
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_STATUSES,
  EMPLOYMENT_TYPES,
} from "@/lib/job-constants";
import {
  createRequirement,
  updateRequirement,
} from "@/app/(app)/requirements/actions";
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
import { JdDropzone } from "@/components/requirements/jd-dropzone";

const selectClassName = "h-9 rounded-md border bg-background px-3 text-sm";

export function RequirementForm({
  requirement,
  vendors,
}: {
  requirement?: Requirement;
  vendors: { id: string; name: string }[];
}) {
  const action = requirement ? updateRequirement : createRequirement;
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {requirement ? (
        <input type="hidden" name="id" value={requirement.id} />
      ) : null}

      {/* Role */}
      <Card>
        <CardHeader>
          <CardTitle>Role</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              name="title"
              required
              defaultValue={requirement?.title ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vendor_id">Vendor</Label>
            <select
              id="vendor_id"
              name="vendor_id"
              className={selectClassName}
              defaultValue={requirement?.vendor_id ?? ""}
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
            <Input
              id="end_client"
              name="end_client"
              defaultValue={requirement?.end_client ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="employment_type">Employment type</Label>
            <select
              id="employment_type"
              name="employment_type"
              className={selectClassName}
              defaultValue={requirement?.employment_type ?? ""}
            >
              <option value="" />
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              defaultValue={requirement?.location ?? ""}
            />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              id="remote"
              name="remote"
              type="checkbox"
              defaultChecked={requirement?.remote}
              className="size-4 rounded border accent-primary"
            />
            <Label htmlFor="remote">Remote</Label>
          </div>
        </CardContent>
      </Card>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="experience">Experience</Label>
            <Input
              id="experience"
              name="experience"
              defaultValue={requirement?.experience ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="skills">Skills</Label>
            <Input
              id="skills"
              name="skills"
              defaultValue={requirement?.skills ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rate">Rate ($/hr)</Label>
            <Input
              id="rate"
              name="rate"
              type="number"
              defaultValue={requirement?.rate ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="closing_date">Closing date</Label>
            <Input
              id="closing_date"
              name="closing_date"
              type="date"
              defaultValue={requirement?.closing_date ?? ""}
            />
          </div>
        </CardContent>
      </Card>

      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="priority">Priority</Label>
            <select
              id="priority"
              name="priority"
              className={selectClassName}
              defaultValue={requirement?.priority ?? "medium"}
            >
              {REQUIREMENT_PRIORITIES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              className={selectClassName}
              defaultValue={requirement?.status ?? "open"}
            >
              {REQUIREMENT_STATUSES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <JdDropzone notesFieldId="notes" />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="notes">JD</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={requirement?.notes ?? ""}
            />
          </div>
        </CardContent>
      </Card>

      {state?.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          render={
            <Link
              href={
                requirement
                  ? `/requirements/${requirement.id}`
                  : "/requirements"
              }
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
            "Save requirement"
          )}
        </Button>
      </div>
    </form>
  );
}

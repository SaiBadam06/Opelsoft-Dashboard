"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { INTERVIEW_MODES, INTERVIEW_RESULTS } from "@/lib/work-constants";
import { createInterview } from "@/app/(app)/interviews/actions";
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

export function InterviewForm({
  candidates,
  requirements,
}: {
  candidates: { id: string; full_name: string }[];
  requirements: { id: string; title: string }[];
}) {
  const [state, formAction, pending] = useActionState(createInterview, null);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* Interview */}
      <Card>
        <CardHeader>
          <CardTitle>Interview</CardTitle>
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
            <Label htmlFor="requirement_id">Requirement</Label>
            <select
              id="requirement_id"
              name="requirement_id"
              className={selectClassName}
              defaultValue=""
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
            <Label htmlFor="end_client">End client</Label>
            <Input id="end_client" name="end_client" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="round">Round</Label>
            <Input id="round" name="round" placeholder="Round 1" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="interview_date">Interview date</Label>
            <Input
              id="interview_date"
              name="interview_date"
              type="datetime-local"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mode">Mode</Label>
            <select
              id="mode"
              name="mode"
              className={selectClassName}
              defaultValue=""
            >
              <option value="" />
              {INTERVIEW_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="interviewer">Interviewer</Label>
            <Input id="interviewer" name="interviewer" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="result">Result</Label>
            <select
              id="result"
              name="result"
              className={selectClassName}
              defaultValue="scheduled"
            >
              {INTERVIEW_RESULTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
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
        <Button variant="outline" render={<Link href="/interviews" />}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className={cn("animate-spin")} />
              Saving…
            </>
          ) : (
            "Save interview"
          )}
        </Button>
      </div>
    </form>
  );
}

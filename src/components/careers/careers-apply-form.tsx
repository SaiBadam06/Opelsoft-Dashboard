"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { Loader2, Upload } from "lucide-react";

import { cn } from "@/lib/utils";
import { applyToJob } from "@/app/careers/apply-actions";
import type { CareerSite } from "@/lib/career-sites";
import { withCareersSiteQuery } from "@/lib/career-urls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CareersApplyForm({
  jobSlug,
  jobTitle,
  site,
}: {
  jobSlug: string;
  jobTitle: string;
  site: Pick<CareerSite, "slug" | "domain">;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(applyToJob, null);

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="flex w-full max-w-xl flex-col gap-5"
    >
      <input type="hidden" name="job_slug" value={jobSlug} />
      {/* Honeypot — hidden from users */}
      <input
        type="text"
        name="company_website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden
      />

      <div>
        <h1 className="text-2xl font-bold">Apply for {jobTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fields marked with * are required.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="candidate_name">
          Full name <span className="text-destructive">*</span>
        </Label>
        <Input id="candidate_name" name="candidate_name" required autoComplete="name" className="min-h-11" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">
          Email <span className="text-destructive">*</span>
        </Label>
        <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" required className="min-h-11" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" className="min-h-11" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" autoComplete="address-level2" className="min-h-11" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="linkedin_url">LinkedIn URL</Label>
        <Input id="linkedin_url" name="linkedin_url" type="url" inputMode="url" className="min-h-11" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="portfolio_url">Portfolio URL</Label>
        <Input id="portfolio_url" name="portfolio_url" type="url" inputMode="url" className="min-h-11" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="resume">
          Resume (PDF or Word) <span className="text-destructive">*</span>
        </Label>
        <Input
          ref={fileRef}
          id="resume"
          name="resume"
          type="file"
          required
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="min-h-11 cursor-pointer text-base file:mr-3 file:min-h-8"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cover_note">Cover note</Label>
        <Textarea id="cover_note" name="cover_note" rows={4} />
      </div>

      {state?.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button type="submit" disabled={pending} className="min-h-11 w-full sm:w-auto">
          {pending ? (
            <>
              <Loader2 className={cn("animate-spin")} />
              Submitting…
            </>
          ) : (
            <>
              <Upload />
              Submit application
            </>
          )}
        </Button>
        <Button
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          render={
            <Link
              href={withCareersSiteQuery(`/careers/jobs/${jobSlug}`, site)}
            />
          }
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

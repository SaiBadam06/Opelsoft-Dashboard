"use client";

import Link from "next/link";
import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { RequirementWithVendor } from "@/lib/requirements";
import type { RequirementPostingState } from "@/lib/job-postings-admin";
import {
  JOB_POSTING_STATUSES,
  WORKPLACE_TYPES,
  type JobPostingStatus,
} from "@/lib/career-constants";
import { buildCareersJobUrl } from "@/lib/career-urls";
import { slugifyJobTitle } from "@/lib/job-posting-slug";
import {
  closeJobPosting,
  publishJobPosting,
  saveJobPostingDraft,
} from "@/app/(app)/requirements/posting-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const selectClassName = "h-9 rounded-md border bg-background px-3 text-sm";

function statusBadgeClass(status: JobPostingStatus): string {
  switch (status) {
    case "published":
      return "bg-success/15 text-success";
    case "closed":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-warning/15 text-warning";
  }
}

function defaultWorkplace(requirement: RequirementWithVendor) {
  return requirement.remote ? "remote" : "onsite";
}

export function JobPostingCard({
  requirement,
  state,
}: {
  requirement: RequirementWithVendor;
  state: RequirementPostingState;
}) {
  const router = useRouter();
  const [draftState, draftAction, draftPending] = useActionState(
    saveJobPostingDraft,
    null,
  );
  const [publishState, publishAction, publishPending] = useActionState(
    publishJobPosting,
    null,
  );
  const [closing, startClose] = useTransition();

  const posting = state.posting;
  const status: JobPostingStatus = posting?.status ?? "draft";
  const statusLabel =
    JOB_POSTING_STATUSES.find((s) => s.value === status)?.label ?? status;

  const activeSiteIds = new Set(
    state.distributions
      .filter((d) => d.is_active && d.career_site_id)
      .map((d) => d.career_site_id as string),
  );

  const defaultTitle = posting?.title ?? requirement.title;
  const defaultSlug =
    posting?.public_slug ?? slugifyJobTitle(requirement.title);
  const defaultLocation = posting?.location ?? requirement.location;
  const defaultWorkplaceType =
    posting?.workplace_type ?? defaultWorkplace(requirement);
  const defaultEmployment =
    posting?.employment_type ?? requirement.employment_type;
  const defaultDescription = posting?.description ?? requirement.notes;
  const defaultSkills = posting?.skills ?? requirement.skills;

  function actionError(
    state: { error?: string; ok?: boolean } | null | undefined,
  ): string | null {
    return state && "error" in state && state.error ? state.error : null;
  }

  const error = actionError(draftState) ?? actionError(publishState);

  const publishedSite = state.careerSites.find((s) => activeSiteIds.has(s.id));
  const viewUrl =
    posting?.status === "published" && publishedSite
      ? buildCareersJobUrl(publishedSite, posting.public_slug)
      : null;

  function onClose() {
    startClose(async () => {
      const res = await closeJobPosting(requirement.id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Posting closed");
    });
  }

  const pending = draftPending || publishPending || closing;

  useEffect(() => {
    if (draftState?.ok) {
      toast.success("Draft saved");
      router.refresh();
    }
  }, [draftState, router]);

  useEffect(() => {
    if (publishState?.ok) {
      toast.success("Published to careers");
      router.refresh();
    }
  }, [publishState, router]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Careers posting</CardTitle>
        <Badge className={statusBadgeClass(status)}>{statusLabel}</Badge>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-5">
          <input type="hidden" name="requirement_id" value={requirement.id} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="posting-title">Public title</Label>
              <Input
                id="posting-title"
                name="title"
                defaultValue={defaultTitle}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="posting-slug">URL slug</Label>
              <Input
                id="posting-slug"
                name="public_slug"
                defaultValue={defaultSlug}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="posting-location">Location</Label>
              <Input
                id="posting-location"
                name="location"
                defaultValue={defaultLocation ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="posting-workplace">Workplace</Label>
              <select
                id="posting-workplace"
                name="workplace_type"
                className={selectClassName}
                defaultValue={defaultWorkplaceType}
              >
                {WORKPLACE_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="posting-employment">Employment type</Label>
              <Input
                id="posting-employment"
                name="employment_type"
                defaultValue={defaultEmployment ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="posting-skills">Skills</Label>
              <Input
                id="posting-skills"
                name="skills"
                defaultValue={defaultSkills ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="posting-description">Public description</Label>
              <Textarea
                id="posting-description"
                name="description"
                rows={6}
                defaultValue={defaultDescription ?? ""}
              />
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Distribute to</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {state.careerSites.map((site) => (
                <label
                  key={site.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name="career_site_ids"
                    value={site.id}
                    defaultChecked={
                      activeSiteIds.size > 0
                        ? activeSiteIds.has(site.id)
                        : site.slug === "opelsoft"
                    }
                    className="size-4 rounded border"
                  />
                  {site.name} careers
                </label>
              ))}
              {state.channels
                .filter((c) => c.slug === "linkedin" || c.slug === "indeed")
                .map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <input
                      type="checkbox"
                      disabled
                      className="size-4 rounded border"
                    />
                    {c.name} (Coming soon)
                  </label>
                ))}
            </div>
          </fieldset>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              variant="outline"
              disabled={pending}
              formAction={draftAction}
            >
              {draftPending ? (
                <>
                  <Loader2 className={cn("animate-spin")} />
                  Saving…
                </>
              ) : (
                "Save draft"
              )}
            </Button>
            <Button type="submit" disabled={pending} formAction={publishAction}>
              {publishPending ? (
                <>
                  <Loader2 className={cn("animate-spin")} />
                  Publishing…
                </>
              ) : (
                "Publish"
              )}
            </Button>
            {posting && status !== "closed" ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={onClose}
              >
                Close posting
              </Button>
            ) : null}
            {viewUrl ? (
              <Button
                variant="ghost"
                render={
                  <Link href={viewUrl} target="_blank" rel="noopener noreferrer" />
                }
              >
                View on careers
                <ExternalLink />
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

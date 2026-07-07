"use client";

import Link from "next/link";
import { useTransition } from "react";
import { ArrowLeft, Download, ExternalLink, FileInput, UserPlus } from "lucide-react";
import { toast } from "sonner";

import type { JobApplicationRow } from "@/lib/job-applications";
import { applicationStatusLabel } from "@/lib/career-constants";
import { buildCareersJobUrl } from "@/lib/career-urls";
import { formatDateTime } from "@/lib/format";
import {
  convertApplicationToCandidate,
  createSubmissionFromApplication,
  getApplicationResumeUrl,
} from "../actions";
import { ApplicationStatusSelect } from "../application-status-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ApplicationDetail({
  application,
  linkedCandidateId,
}: {
  application: JobApplicationRow;
  linkedCandidateId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [resumePending, startResume] = useTransition();
  const [submissionPending, startSubmission] = useTransition();

  const canCreateSubmission =
    Boolean(linkedCandidateId) &&
    Boolean(application.requirement_id) &&
    application.status === "converted";

  const siteForUrl =
    application.site_slug && application.site_name
      ? { slug: application.site_slug, domain: null }
      : null;

  function downloadResume() {
    if (!application.resume_path) return;
    startResume(async () => {
      const res = await getApplicationResumeUrl(application.resume_path!);
      if (res && "error" in res) {
        toast.error(res.error);
        return;
      }
      window.open(res.url, "_blank", "noopener,noreferrer");
    });
  }

  function convert() {
    startTransition(async () => {
      const res = await convertApplicationToCandidate(application.id);
      if (res && "error" in res) {
        toast.error(res.error);
        if ("candidateId" in res && res.candidateId) {
          toast.info("Open the partial candidate record to finish setup.");
        }
      }
    });
  }

  function createSubmission() {
    startSubmission(async () => {
      const res = await createSubmissionFromApplication(application.id);
      if (res && "error" in res) {
        toast.error(res.error);
        if ("submissionId" in res && res.submissionId) {
          toast.info("Open the existing submission instead.");
        }
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit px-0"
            render={<Link href="/applications" />}
          >
            <ArrowLeft />
            Back to applications
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {application.candidate_name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Applied {formatDateTime(application.created_at)} ·{" "}
              {applicationStatusLabel(application.status)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {application.status !== "converted" ? (
            <Button disabled={pending} onClick={convert}>
              <UserPlus />
              Convert to candidate
            </Button>
          ) : null}
          {canCreateSubmission ? (
            <Button
              variant="secondary"
              disabled={submissionPending}
              onClick={createSubmission}
            >
              <FileInput />
              Create submission
            </Button>
          ) : null}
          {linkedCandidateId && application.requirement_id ? (
            <Button
              variant="outline"
              render={
                <Link
                  href={`/submissions/new?candidate_id=${encodeURIComponent(linkedCandidateId)}&requirement_id=${encodeURIComponent(application.requirement_id)}`}
                />
              }
            >
              <FileInput />
              Pre-fill submission form
            </Button>
          ) : null}
          {application.resume_path ? (
            <Button
              variant="outline"
              disabled={resumePending}
              onClick={downloadResume}
            >
              <Download />
              Download resume
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Application</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Email</p>
              <p className="text-sm">{application.email}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Phone</p>
              <p className="text-sm">{application.phone ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Location
              </p>
              <p className="text-sm">{application.location ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Source
              </p>
              <p className="text-sm capitalize">
                {application.source.replace(/_/g, " ")}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                LinkedIn
              </p>
              {application.linkedin_url ? (
                <a
                  href={application.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Profile
                </a>
              ) : (
                <p className="text-sm">—</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Portfolio
              </p>
              {application.portfolio_url ? (
                <a
                  href={application.portfolio_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Link
                </a>
              ) : (
                <p className="text-sm">—</p>
              )}
            </div>
            {application.cover_note ? (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Cover note
                </p>
                <p className="whitespace-pre-wrap text-sm">
                  {application.cover_note}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Job</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div>
                <p className="font-medium">{application.job_title}</p>
                {application.site_name ? (
                  <Badge variant="outline" className="mt-2">
                    {application.site_name}
                  </Badge>
                ) : null}
              </div>
              {application.job_slug && siteForUrl ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  render={
                    <a
                      href={buildCareersJobUrl(siteForUrl, application.job_slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  <ExternalLink />
                  View public posting
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ApplicationStatusSelect
                id={application.id}
                status={application.status}
                disabled={application.status === "converted"}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

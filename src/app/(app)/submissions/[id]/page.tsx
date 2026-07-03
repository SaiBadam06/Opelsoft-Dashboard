import { notFound } from "next/navigation";

import { requireProfile } from "@/lib/auth";
import {
  getSubmission,
  getSubmissionStatusHistory,
} from "@/lib/submissions";
import {
  submissionStatusLabel,
  submissionStatusBadgeClass,
} from "@/lib/job-constants";
import { PRIME_LAYERS } from "@/lib/job-constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmissionStatusSelect } from "../submissions-table";

const DASH = "—";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

function Text({ value }: { value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return <>{DASH}</>;
  return <>{value}</>;
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireProfile();
  const s = await getSubmission(id);
  if (!s) notFound();
  const history = await getSubmissionStatusHistory(id);

  const primeLayerLabel =
    PRIME_LAYERS.find((p) => p.value === s.prime_layer)?.label ?? null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">
            {s.candidate_name ?? "Submission"}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge className={submissionStatusBadgeClass(s.status)}>
              {submissionStatusLabel(s.status)}
            </Badge>
            {s.requirement_title ? (
              <span className="text-muted-foreground">
                {s.requirement_title}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Last updated {formatDateTime(s.updated_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Status</span>
          <SubmissionStatusSelect id={s.id} status={s.status} />
        </div>
      </div>

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Field label="Candidate">
              <Text value={s.candidate_name} />
            </Field>
            <Field label="Requirement">
              <Text value={s.requirement_title} />
            </Field>
            <Field label="Vendor">
              <Text value={s.vendor_name} />
            </Field>
            <Field label="End client">
              <Text value={s.end_client} />
            </Field>
            <Field label="Prime / Layer">
              <Text value={primeLayerLabel} />
            </Field>
            <Field label="Rate">
              {s.rate != null ? `$${s.rate}/hr` : DASH}
            </Field>
            <Field label="Resume version">
              <Text value={s.resume_version} />
            </Field>
            <Field label="Submitted date">
              {formatDate(s.submitted_date)}
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Status history */}
      <Card>
        <CardHeader>
          <CardTitle>Status history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No changes yet.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {history.map((h) => (
                <li key={h.id} className="flex items-center gap-3 text-sm">
                  <Badge className={submissionStatusBadgeClass(h.to_status)}>
                    {submissionStatusLabel(h.to_status)}
                  </Badge>
                  {h.from_status ? (
                    <span className="text-xs text-muted-foreground">
                      from {submissionStatusLabel(h.from_status)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      created
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {h.changed_by_name ? `${h.changed_by_name} · ` : ""}
                    {formatDateTime(h.changed_at)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {s.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{s.notes}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

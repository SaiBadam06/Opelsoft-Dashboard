import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { requireProfile } from "@/lib/auth";
import { getRequirement } from "@/lib/requirements";
import { listNotes } from "@/lib/notes";
import { listActivityLogs } from "@/lib/activity";
import {
  requirementStatusLabel,
  requirementStatusBadgeClass,
  requirementPriorityLabel,
  priorityBadgeClass,
} from "@/lib/job-constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteRequirementButton } from "../requirements-table";
import { NotesSection } from "@/components/shared/notes-section";
import { ActivityLogSection } from "@/components/shared/activity-log-section";

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

function LongText({ value }: { value: string | null }) {
  if (!value) return <span>{DASH}</span>;
  return <span className="whitespace-pre-wrap">{value}</span>;
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{children}</div>;
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireProfile();
  const r = await getRequirement(id);
  if (!r) notFound();

  const [notes, activityLogs] = await Promise.all([
    listNotes("requirement", id),
    listActivityLogs("requirement", id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{r.title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge className={requirementStatusBadgeClass(r.status)}>
              {requirementStatusLabel(r.status)}
            </Badge>
            <Badge className={priorityBadgeClass(r.priority)}>
              {requirementPriorityLabel(r.priority)}
            </Badge>
            {r.vendor_name ? (
              <span className="text-muted-foreground">{r.vendor_name}</span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            render={<Link href={`/requirements/${id}/edit`} />}
          >
            <Pencil />
            Edit
          </Button>
          {me.role === "admin" ? <DeleteRequirementButton id={id} /> : null}
        </div>
      </div>

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <Grid>
            <Field label="Vendor">
              <Text value={r.vendor_name} />
            </Field>
            <Field label="End client">
              <Text value={r.end_client} />
            </Field>
            <Field label="Location">
              {r.location || r.remote ? (
                <span className="flex items-center gap-2">
                  <Text value={r.location} />
                  {r.remote ? <Badge variant="outline">Remote</Badge> : null}
                </span>
              ) : (
                DASH
              )}
            </Field>
            <Field label="Employment type">
              <Text value={r.employment_type} />
            </Field>
            <Field label="Rate">
              {r.rate != null ? `$${r.rate}/hr` : DASH}
            </Field>
            <Field label="Closing date">
              <Text value={r.closing_date} />
            </Field>
          </Grid>
        </CardContent>
      </Card>

      {/* Requirements detail */}
      <Card>
        <CardHeader>
          <CardTitle>Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <Grid>
            <Field label="Experience">
              <LongText value={r.experience} />
            </Field>
            <Field label="Skills">
              <LongText value={r.skills} />
            </Field>
          </Grid>
        </CardContent>
      </Card>

      {/* JD */}
      <Card>
        <CardHeader>
          <CardTitle>JD</CardTitle>
        </CardHeader>
        <CardContent>
          <LongText value={r.notes} />
        </CardContent>
      </Card>

      {/* Activity History */}
      <Card>
        <CardHeader>
          <CardTitle>Activity History</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityLogSection logs={activityLogs} />
        </CardContent>
      </Card>

      {/* Manual Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <NotesSection 
            notes={notes} 
            entityType="requirement" 
            entityId={id} 
            currentUserRole={me.role} 
            currentUserId={me.id} 
          />
        </CardContent>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { requireProfile } from "@/lib/auth";
import { getVendor } from "@/lib/vendors";
import { listNotes } from "@/lib/notes";
import { listActivityLogs } from "@/lib/activity";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function Text({ value }: { value: string | null | undefined }) {
  if (!value) return <>{DASH}</>;
  return <>{value}</>;
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireProfile();
  const vendor = await getVendor(id);
  if (!vendor) notFound();

  const [notes, activityLogs] = await Promise.all([
    listNotes("vendor", id),
    listActivityLogs("vendor", id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{vendor.name}</h1>
          <p className="text-xs text-muted-foreground">
            Last updated {formatDateTime(vendor.updated_at)}
          </p>
        </div>
        <Button
          variant="outline"
          render={<Link href={`/vendors/${id}/edit`} />}
        >
          <Pencil />
          Edit
        </Button>
      </div>

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Field label="Contact name">
              <Text value={vendor.contact_name} />
            </Field>
            <Field label="Email">
              <Text value={vendor.email} />
            </Field>
            <Field label="Phone">
              <Text value={vendor.phone} />
            </Field>
            <Field label="Added">
              {formatDateTime(vendor.created_at)}
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Notes field from vendor record */}
      {vendor.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{vendor.notes}</p>
          </CardContent>
        </Card>
      ) : null}

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
            entityType="vendor"
            entityId={id}
            currentUserRole={me.role}
            currentUserId={me.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}

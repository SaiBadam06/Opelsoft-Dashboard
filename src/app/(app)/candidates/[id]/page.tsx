import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { requireProfile } from "@/lib/auth";
import {
  getCandidate,
  listCoordinators,
  type Candidate,
} from "@/lib/candidates";
import { listNotes } from "@/lib/notes";
import { listActivityLogs } from "@/lib/activity";
import {
  statusLabel,
  statusBadgeClass,
  stageLabel,
} from "@/lib/candidate-constants";
import { formatDateTime } from "@/lib/format";
import { listDocuments } from "@/app/(app)/candidates/document-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ReassignControl,
  DeleteCandidateButton,
} from "../reassign-control";
import { DocumentsTab } from "@/app/(app)/candidates/documents-tab";
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

function ExternalLink({ value }: { value: string | null }) {
  if (!value) return <>{DASH}</>;
  const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline-offset-4 hover:underline"
    >
      {value}
    </a>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{children}</div>
  );
}

const TAB_VALUES = ["profile", "professional", "status", "timeline", "documents", "notes"];

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const initialTab = tab && TAB_VALUES.includes(tab) ? tab : "profile";
  const me = await requireProfile();
  const candidate = await getCandidate(id);
  if (!candidate) notFound();

  const c: Candidate = candidate;
  const [documents, notes, activityLogs] = await Promise.all([
    listDocuments(id),
    listNotes("candidate", id),
    listActivityLogs("candidate", id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{c.full_name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge className={statusBadgeClass(c.status)}>
              {statusLabel(c.status)}
            </Badge>
            <span className="text-muted-foreground">
              {stageLabel(c.pipeline_stage)}
            </span>
            <span>{c.rate !== null ? `$${c.rate}/hr` : DASH}</span>
            <span className="flex items-center gap-2">
              <Text value={c.visa} />
              {c.visa_transfer ? <Badge variant="outline">H1T</Badge> : null}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            render={<Link href={`/candidates/${id}/edit`} />}
          >
            <Pencil />
            Edit
          </Button>
          <DeleteCandidateButton id={id} />
        </div>
      </div>

      {/* Admin assignment */}
      {me.role === "admin" ? (
        <Card>
          <CardHeader>
            <CardTitle>Assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <ReassignControl
              candidateId={id}
              currentCoordinatorId={c.assigned_coordinator_id}
              coordinators={await listCoordinators()}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Tabs */}
      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="professional">Professional</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardContent>
              <Grid>
                <Field label="Email">
                  <Text value={c.email} />
                </Field>
                <Field label="Phone">
                  <Text value={c.phone} />
                </Field>
                <Field label="Location">
                  <Text value={c.location} />
                </Field>
                <Field label="Experience">
                  {c.experience_years !== null ? (
                    `${c.experience_years} yrs`
                  ) : (
                    DASH
                  )}
                </Field>
                <Field label="Current company">
                  <Text value={c.current_company} />
                </Field>
                <Field label="Relocation">
                  <Text value={c.relocation} />
                </Field>

                <Field label="Availability">
                  <Text value={c.availability} />
                </Field>
                <Field label="LinkedIn">
                  <ExternalLink value={c.linkedin} />
                </Field>
                <Field label="GitHub">
                  <ExternalLink value={c.github} />
                </Field>
                <Field label="Portfolio">
                  <ExternalLink value={c.portfolio} />
                </Field>
              </Grid>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="professional">
          <Card>
            <CardContent>
              <Grid>
                <Field label="Primary skills">
                  <LongText value={c.primary_skills} />
                </Field>
                <Field label="Secondary skills">
                  <LongText value={c.secondary_skills} />
                </Field>
                <Field label="Certifications">
                  <LongText value={c.certifications} />
                </Field>
                <Field label="Projects">
                  <LongText value={c.projects} />
                </Field>
                <Field label="Education">
                  <LongText value={c.education} />
                </Field>
                <Field label="Preferred location">
                  <Text value={c.preferred_location} />
                </Field>
              </Grid>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status">
          <Card>
            <CardContent>
              <Grid>
                <Field label="Status">
                  <Badge className={statusBadgeClass(c.status)}>
                    {statusLabel(c.status)}
                  </Badge>
                </Field>
                <Field label="Pipeline stage">
                  {stageLabel(c.pipeline_stage)}
                </Field>
                <Field label="Visa transfer">
                  {c.visa_transfer ? "Yes" : "No"}
                </Field>
                <Field label="Notes">
                  <LongText value={c.notes} />
                </Field>
              </Grid>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <Grid>
                <Field label="Created">
                  {formatDateTime(c.created_at)}
                </Field>
                <Field label="Updated">
                  {formatDateTime(c.updated_at)}
                </Field>
              </Grid>
              <div className="mt-4 border-t pt-4">
                <h3 className="font-semibold mb-4">Activity History</h3>
                <ActivityLogSection logs={activityLogs} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsTab candidateId={id} documents={documents} />
        </TabsContent>
        
        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle>Manual Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <NotesSection 
                notes={notes} 
                entityType="candidate" 
                entityId={id} 
                currentUserRole={me.role} 
                currentUserId={me.id} 
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

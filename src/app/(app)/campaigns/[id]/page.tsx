import { notFound } from "next/navigation";

import { requireProfile } from "@/lib/auth";
import { getCampaign, listRecipients, type RecipientStatus } from "@/lib/campaigns";
import { formatDateTime } from "@/lib/format";
import { campaignStatusLabel, campaignStatusBadgeClass } from "@/lib/job-constants";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "./Progress";

const DASH = "—";

function recipientStatusBadgeClass(s: RecipientStatus): string {
  switch (s) {
    case "queued":
      return "bg-muted text-muted-foreground";
    case "sending":
      return "bg-info text-info-foreground";
    case "sent":
      return "bg-success text-success-foreground";
    case "failed":
      return "bg-destructive text-white";
    case "suppressed":
      return "bg-warning text-warning-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireProfile();
  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  const recipients = await listRecipients(id);
  const suppressed = recipients.filter((r) => r.status === "suppressed").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
          <p className="text-sm text-muted-foreground">
            {campaign.subject} · From {campaign.from_address}
          </p>
        </div>
        <Badge className={campaignStatusBadgeClass(campaign.status)}>
          {campaignStatusLabel(campaign.status)}
        </Badge>
      </div>

      <Progress
        id={campaign.id}
        initialStatus={campaign.status}
        total={campaign.total}
        sent={campaign.sent_count}
        failed={campaign.failed_count}
        suppressed={suppressed}
      />

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Last error</TableHead>
              <TableHead>Sent at</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No recipients
                </TableCell>
              </TableRow>
            ) : (
              recipients.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.email}</TableCell>
                  <TableCell>
                    <Badge className={recipientStatusBadgeClass(r.status)}>{r.status}</Badge>
                  </TableCell>
                  <TableCell>{r.attempts}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {r.last_error ?? DASH}
                  </TableCell>
                  <TableCell>{formatDateTime(r.sent_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

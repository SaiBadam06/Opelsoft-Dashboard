import Link from "next/link";
import { Mail, Plus } from "lucide-react";

import { requireProfile } from "@/lib/auth";
import { listCampaigns } from "@/lib/campaigns";
import { formatDateTime } from "@/lib/format";
import { campaignStatusLabel, campaignStatusBadgeClass } from "@/lib/job-constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function CampaignsPage() {
  await requireProfile();
  const campaigns = await listCampaigns();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Bulk email outreach to vendors and pasted or uploaded recipient lists
          </p>
        </div>
        <Button render={<Link href="/campaigns/new" />}>
          <Plus />
          New Campaign
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Mail className="size-6" />
            </div>
            <p className="font-medium">No campaigns yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first campaign to start sending.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link href={`/campaigns/${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge className={campaignStatusBadgeClass(c.status)}>
                      {campaignStatusLabel(c.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{c.sent_count}</TableCell>
                  <TableCell>{c.failed_count}</TableCell>
                  <TableCell>{c.total}</TableCell>
                  <TableCell>{formatDateTime(c.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

import Link from "next/link";
import {
  CHANNEL_DESCRIPTIONS,
  channelStatusLabel,
  type DistributionChannel,
} from "@/lib/distribution-channels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function statusBadgeClass(channel: DistributionChannel): string {
  if (channel.is_active) return "bg-success/15 text-success";
  return "bg-muted text-muted-foreground";
}

export function ChannelsTable({
  channels,
}: {
  channels: DistributionChannel[];
}) {
  if (channels.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No distribution channels found. Run migration 0008 first.
      </p>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Channel registry</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Channel</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {channels.map((channel) => (
              <TableRow key={channel.id}>
                <TableCell className="font-medium">{channel.name}</TableCell>
                <TableCell>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {channel.slug}
                  </code>
                </TableCell>
                <TableCell>
                  <Badge className={statusBadgeClass(channel)}>
                    {channelStatusLabel(channel)}
                  </Badge>
                </TableCell>
                <TableCell className="hidden max-w-md text-muted-foreground md:table-cell">
                  {CHANNEL_DESCRIPTIONS[channel.slug] ??
                    "Distribution channel for job postings."}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="mt-4 text-xs text-muted-foreground">
          Inactive channels do not create{" "}
          <code className="rounded bg-muted px-1 py-0.5">posting_distributions</code>{" "}
          rows. Application{" "}
          <code className="rounded bg-muted px-1 py-0.5">source</code> values are
          reserved for future LinkedIn and Indeed inbound traffic. Recruiters
          select career sites when publishing from{" "}
          <Link
            href="/requirements"
            className="text-primary underline-offset-4 hover:underline"
          >
            Requirements
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}

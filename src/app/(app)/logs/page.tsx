import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import {
  listGlobalActivityLogs,
  getGlobalLogOptions,
  EntityType,
} from "@/lib/activity";
import { LogsFilters, LogsTabs } from "./logs-filters";
import {
  submissionStatusLabel,
  submissionStatusBadgeClass,
} from "@/lib/job-constants";
import { formatDateTime } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Activity Logs | OpelSoft",
};

export default async function LogsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdmin();

  const searchParams = await props.searchParams;
  const tab = (searchParams.tab as EntityType) || "candidate";

  const filters = {
    entity_id: searchParams.entity_id as string | undefined,
    action: searchParams.action as string | undefined,
    from: searchParams.from as string | undefined,
    to: searchParams.to as string | undefined,
  };

  const [{ logs, error }, { actions, entities }] = await Promise.all([
    listGlobalActivityLogs(tab, filters),
    getGlobalLogOptions(tab),
  ]);

  const getEntityLabel = (t: EntityType) => {
    switch (t) {
      case "candidate": return "Candidate";
      case "requirement": return "Requirement";
      case "submission": return "Submission";
      case "vendor": return "Vendor";
      default: return "Entity";
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Activity Logs</h1>
      </div>

      <LogsTabs currentTab={tab} />

      <div className="rounded-xl border bg-card p-4">
        <LogsFilters 
          entities={entities} 
          actions={actions} 
          entityLabel={getEntityLabel(tab)}
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          Unable to load activity logs: {error}
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>{getEntityLabel(tab)}</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>By</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No activity logs match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">
                      {log[`${tab}_id`] ? (
                        <Link
                          href={`/${tab}s/${log[`${tab}_id`]}`}
                          className="hover:underline text-primary"
                        >
                          {log.entity_name || `Unknown ${getEntityLabel(tab)}`}
                        </Link>
                      ) : (
                        log.entity_name || `Unknown ${getEntityLabel(tab)}`
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{log.action}</span>
                        {log.action === "Status changed" && log.metadata?.from && log.metadata?.to ? (
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              className={cn(
                                "font-normal",
                                submissionStatusBadgeClass(String(log.metadata.from)),
                              )}
                            >
                              {submissionStatusLabel(String(log.metadata.from))}
                            </Badge>
                            <span className="text-muted-foreground text-xs">→</span>
                            <Badge
                              className={cn(
                                "font-normal",
                                submissionStatusBadgeClass(String(log.metadata.to)),
                              )}
                            >
                              {submissionStatusLabel(String(log.metadata.to))}
                            </Badge>
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{log.actor_name || "System"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                      {formatDateTime(log.created_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

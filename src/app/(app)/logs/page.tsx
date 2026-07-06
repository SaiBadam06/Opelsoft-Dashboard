import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import {
  listStatusLogs,
  parseLogFilters,
} from "@/lib/submissions";
import { candidateOptions } from "@/lib/candidates";
import { LogsFilters } from "./logs-filters";
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
  title: "Submission Logs | OpelSoft",
};

export default async function LogsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const searchParams = await props.searchParams;
  const filters = parseLogFilters(searchParams);
  const [logs, candidates] = await Promise.all([
    listStatusLogs(filters),
    candidateOptions(),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Submission Logs</h1>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <LogsFilters candidates={candidates} />
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Candidate</TableHead>
              <TableHead>Change</TableHead>
              <TableHead>By</TableHead>
              <TableHead className="text-right">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  No status changes match these filters.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">
                    {log.submission_id ? (
                      <Link
                        href={`/submissions/${log.submission_id}`}
                        className="hover:underline text-primary"
                      >
                        {log.candidate_name || "Unknown Candidate"}
                      </Link>
                    ) : (
                      log.candidate_name || "Unknown Candidate"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {log.from_status ? (
                        <>
                          <Badge
                            className={cn(
                              "font-normal",
                              submissionStatusBadgeClass(log.from_status)
                            )}
                          >
                            {submissionStatusLabel(log.from_status)}
                          </Badge>
                          <span className="text-muted-foreground">→</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-sm italic mr-2">created as</span>
                      )}
                      <Badge
                        className={cn(
                          "font-normal",
                          submissionStatusBadgeClass(log.to_status)
                        )}
                      >
                        {submissionStatusLabel(log.to_status)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{log.changed_by_name || "System"}</TableCell>
                  <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                    {formatDateTime(log.changed_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

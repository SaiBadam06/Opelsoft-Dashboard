"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Inbox, Search } from "lucide-react";

import type { JobApplicationRow } from "@/lib/job-applications";
import {
  JOB_APPLICATION_STATUSES,
} from "@/lib/career-constants";
import { formatDateTime } from "@/lib/format";
import { ApplicationStatusSelect } from "./application-status-select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function matches(row: JobApplicationRow, q: string): boolean {
  const haystack = [
    row.candidate_name,
    row.email,
    row.job_title,
    row.site_name,
    row.location,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function ApplicationsTable({
  applications,
  careerSites,
}: {
  applications: JobApplicationRow[];
  careerSites: { slug: string; name: string }[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [siteFilter, setSiteFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applications.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (siteFilter !== "all" && row.site_slug !== siteFilter) return false;
      if (q && !matches(row, q)) return false;
      return true;
    });
  }, [applications, search, statusFilter, siteFilter]);

  const selectClassName =
    "h-9 rounded-md border bg-background px-3 text-sm";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, job, or site…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          className={selectClassName}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          {JOB_APPLICATION_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          className={selectClassName}
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          aria-label="Filter by career site"
        >
          <option value="all">All sites</option>
          {careerSites.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <Inbox className="size-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">No applications yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {applications.length === 0
              ? "Publish a job on the careers site and candidates will appear here when they apply."
              : "No applications match your filters."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applied</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id} className="cursor-pointer">
                  <TableCell>
                    <Link
                      href={`/applications/${row.id}`}
                      className="font-medium hover:underline"
                    >
                      {row.candidate_name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {row.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/applications/${row.id}`}
                      className="hover:underline"
                    >
                      {row.job_title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {row.site_name ? (
                      <Badge variant="outline">{row.site_name}</Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <ApplicationStatusSelect
                      id={row.id}
                      status={row.status}
                      disabled={row.status === "converted"}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(row.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {filtered.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {applications.length} application
          {applications.length === 1 ? "" : "s"}
        </p>
      ) : null}
    </div>
  );
}

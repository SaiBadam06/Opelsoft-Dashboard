"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  MoreHorizontal,
  Search,
  Send,
  Trash2,
} from "lucide-react";

import type { SubmissionRow } from "@/lib/submissions";
import {
  SUBMISSION_STATUSES,
  submissionStatusBadgeClass,
  submissionStatusLabel,
  type SubmissionStatus,
} from "@/lib/job-constants";
import { PRIME_LAYERS } from "@/lib/job-constants";
import {
  deleteSubmission,
  setSubmissionStatus,
} from "@/app/(app)/submissions/actions";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const DASH = "—";

function primeLayerLabel(value: string): string {
  return PRIME_LAYERS.find((p) => p.value === value)?.label ?? value;
}

function matches(s: SubmissionRow, q: string): boolean {
  const haystack = [
    s.candidate_name,
    s.requirement_title,
    s.vendor_name,
    s.end_client,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

// Inline, fully-styled status editor for the submissions table.
function SubmissionStatusSelect({
  id,
  status,
}: {
  id: string;
  status: SubmissionStatus;
}) {
  const router = useRouter();
  const [value, setValue] = useState<SubmissionStatus>(status);
  const [pending, startTransition] = useTransition();

  function choose(next: SubmissionStatus) {
    if (next === value) return;
    const prev = value;
    setValue(next);
    startTransition(async () => {
      const res = await setSubmissionStatus(id, next);
      if (res && "error" in res) {
        toast.error(res.error);
        setValue(prev);
        return;
      }
      toast.success("Status updated");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "inline-flex w-32 items-center justify-between gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring",
          submissionStatusBadgeClass(value),
          pending && "opacity-60",
        )}
      >
        <span className="truncate">{submissionStatusLabel(value)}</span>
        <ChevronDown className="size-3 shrink-0 opacity-80" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-52"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuGroup>
          {SUBMISSION_STATUSES.map((o) => (
            <DropdownMenuItem
              key={o.value}
              onClick={() => choose(o.value)}
              className="gap-2"
            >
              <span className="flex-1">{o.label}</span>
              {o.value === value ? (
                <Check className="size-3.5 text-muted-foreground" />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SubmissionRowActions({ submission }: { submission: SubmissionRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const label = submission.candidate_name ?? "this submission";

  function confirmDelete() {
    startTransition(async () => {
      const res = await deleteSubmission(submission.id);
      if (res && "error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Submission removed");
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Submission actions"
              disabled={pending}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete submission?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the submission for {label}. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function SubmissionsTable({
  submissions,
  isAdmin,
}: {
  submissions: SubmissionRow[];
  isAdmin: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return submissions;
    return submissions.filter((s) => matches(s, q));
  }, [submissions, query]);

  if (submissions.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Send className="size-6" />
          </div>
          <p className="font-medium">No submissions yet</p>
          <p className="text-sm text-muted-foreground">
            Submit a candidate to a requirement to get started.
          </p>
        </div>
      </Card>
    );
  }

  const colSpan = isAdmin ? 7 : 6;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search candidate, requirement, vendor, client"
          className="pl-8"
        />
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Candidate</TableHead>
              <TableHead>Requirement</TableHead>
              <TableHead>Vendor / Client</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Prime / Layer</TableHead>
              <TableHead>Status</TableHead>
              {isAdmin ? (
                <TableHead className="text-right">Actions</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colSpan}
                  className="py-10 text-center text-muted-foreground"
                >
                  No matches
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(s.submitted_date)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {s.candidate_name ?? DASH}
                  </TableCell>
                  <TableCell>{s.requirement_title ?? DASH}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{s.vendor_name ?? DASH}</span>
                      {s.end_client ? (
                        <span className="text-xs text-muted-foreground">
                          {s.end_client}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {s.rate != null ? `$${s.rate}/hr` : DASH}
                  </TableCell>
                  <TableCell>
                    {s.prime_layer ? (
                      <Badge variant="outline">
                        {primeLayerLabel(s.prime_layer)}
                      </Badge>
                    ) : (
                      DASH
                    )}
                  </TableCell>
                  <TableCell>
                    <SubmissionStatusSelect id={s.id} status={s.status} />
                  </TableCell>
                  {isAdmin ? (
                    <TableCell className="text-right">
                      <SubmissionRowActions submission={s} />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

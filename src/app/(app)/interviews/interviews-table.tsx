"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarClock,
  Check,
  ChevronDown,
  MoreHorizontal,
  Search,
  Trash2,
} from "lucide-react";

import type { InterviewRow } from "@/lib/interviews";
import {
  INTERVIEW_RESULTS,
  interviewResultBadgeClass,
  interviewResultLabel,
  type InterviewResult,
} from "@/lib/work-constants";
import {
  deleteInterview,
  setInterviewResult,
} from "@/app/(app)/interviews/actions";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
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

function matches(i: InterviewRow, q: string): boolean {
  const haystack = [
    i.candidate_name,
    i.requirement_title,
    i.interviewer,
    i.end_client,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

// Inline, fully-styled result editor for the interviews table.
function InterviewResultSelect({
  id,
  result,
}: {
  id: string;
  result: InterviewResult;
}) {
  const router = useRouter();
  const [value, setValue] = useState<InterviewResult>(result);
  const [pending, startTransition] = useTransition();

  function choose(next: InterviewResult) {
    if (next === value) return;
    const prev = value;
    setValue(next);
    startTransition(async () => {
      const res = await setInterviewResult(id, next);
      if (res && "error" in res) {
        toast.error(res.error);
        setValue(prev);
        return;
      }
      toast.success("Result updated");
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
          interviewResultBadgeClass(value),
          pending && "opacity-60",
        )}
      >
        <span className="truncate">{interviewResultLabel(value)}</span>
        <ChevronDown className="size-3 shrink-0 opacity-80" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-44"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuGroup>
          {INTERVIEW_RESULTS.map((o) => (
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

function InterviewRowActions({ interview }: { interview: InterviewRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const label = interview.candidate_name ?? "this interview";

  function confirmDelete() {
    startTransition(async () => {
      const res = await deleteInterview(interview.id);
      if (res && "error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Interview removed");
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
              aria-label="Interview actions"
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
            <AlertDialogTitle>Delete interview?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the interview for {label}. This cannot be
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

export function InterviewsTable({
  interviews,
  isAdmin,
}: {
  interviews: InterviewRow[];
  isAdmin: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return interviews;
    return interviews.filter((i) => matches(i, q));
  }, [interviews, query]);

  if (interviews.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarClock className="size-6" />
          </div>
          <p className="font-medium">No interviews yet</p>
          <p className="text-sm text-muted-foreground">
            Log an interview to track rounds and outcomes.
          </p>
        </div>
      </Card>
    );
  }

  const colSpan = isAdmin ? 8 : 7;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search candidate, requirement, interviewer, client"
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
              <TableHead>Round</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Interviewer</TableHead>
              <TableHead>Result</TableHead>
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
              filtered.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(i.interview_date)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {i.candidate_name ?? DASH}
                  </TableCell>
                  <TableCell>{i.requirement_title ?? DASH}</TableCell>
                  <TableCell>{i.round ?? DASH}</TableCell>
                  <TableCell>{i.mode ?? DASH}</TableCell>
                  <TableCell>{i.interviewer ?? DASH}</TableCell>
                  <TableCell>
                    <InterviewResultSelect id={i.id} result={i.result} />
                  </TableCell>
                  {isAdmin ? (
                    <TableCell className="text-right">
                      <InterviewRowActions interview={i} />
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

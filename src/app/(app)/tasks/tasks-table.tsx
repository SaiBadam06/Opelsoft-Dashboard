"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  ListTodo,
  MoreHorizontal,
  Search,
  Trash2,
} from "lucide-react";

import type { TaskRow } from "@/lib/tasks";
import {
  TASK_STATUSES,
  taskStatusBadgeClass,
  taskStatusLabel,
  taskTypeLabel,
  type TaskStatus,
} from "@/lib/work-constants";
import { deleteTask, setTaskStatus } from "@/app/(app)/tasks/actions";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
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

function matches(t: TaskRow, q: string): boolean {
  const haystack = [t.title, t.candidate_name, t.assignee_name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

// Inline, fully-styled status editor for the tasks table.
function TaskStatusSelect({ id, status }: { id: string; status: TaskStatus }) {
  const router = useRouter();
  const [value, setValue] = useState<TaskStatus>(status);
  const [pending, startTransition] = useTransition();

  function choose(next: TaskStatus) {
    if (next === value) return;
    const prev = value;
    setValue(next);
    startTransition(async () => {
      const res = await setTaskStatus(id, next);
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
          taskStatusBadgeClass(value),
          pending && "opacity-60",
        )}
      >
        <span className="truncate">{taskStatusLabel(value)}</span>
        <ChevronDown className="size-3 shrink-0 opacity-80" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-44"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuGroup>
          {TASK_STATUSES.map((o) => (
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

function TaskRowActions({ task }: { task: TaskRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function confirmDelete() {
    startTransition(async () => {
      const res = await deleteTask(task.id);
      if (res && "error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Task removed");
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
              aria-label="Task actions"
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
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the task “{task.title}”. This cannot be
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

export function TasksTable({
  tasks,
  isAdmin,
}: {
  tasks: TaskRow[];
  isAdmin: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => matches(t, q));
  }, [tasks, query]);

  if (tasks.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ListTodo className="size-6" />
          </div>
          <p className="font-medium">No tasks yet</p>
          <p className="text-sm text-muted-foreground">
            Add a reminder or follow-up to get started.
          </p>
        </div>
      </Card>
    );
  }

  const colSpan = isAdmin ? 6 : 5;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search task, candidate, assignee"
          className="pl-8"
        />
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Candidate</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Due</TableHead>
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
              filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{t.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {taskTypeLabel(t.type)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{t.candidate_name ?? DASH}</TableCell>
                  <TableCell>{t.assignee_name ?? DASH}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(t.due_date)}
                  </TableCell>
                  <TableCell>
                    <TaskStatusSelect id={t.id} status={t.status} />
                  </TableCell>
                  {isAdmin ? (
                    <TableCell className="text-right">
                      <TaskRowActions task={t} />
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

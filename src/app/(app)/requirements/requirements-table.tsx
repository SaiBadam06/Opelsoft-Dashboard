"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Check, ChevronDown, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { RequirementWithVendor } from "@/lib/requirements";
import {
  REQUIREMENT_STATUSES,
  requirementStatusBadgeClass,
  requirementStatusLabel,
  requirementPriorityLabel,
  priorityBadgeClass,
  type RequirementStatus,
} from "@/lib/job-constants";
import { cn } from "@/lib/utils";
import { setRequirementStatus, deleteRequirement } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function statusDotClass(status: RequirementStatus): string {
  switch (status) {
    case "open":
      return "bg-success";
    case "on_hold":
      return "bg-warning";
    case "filled":
      return "bg-primary";
    case "closed":
      return "bg-muted-foreground";
    default:
      return "bg-muted-foreground";
  }
}

// Inline, fully-styled status editor for the requirements table.
function RequirementStatusSelect({
  id,
  status,
}: {
  id: string;
  status: RequirementStatus;
}) {
  const router = useRouter();
  const [value, setValue] = useState<RequirementStatus>(status);
  const [pending, startTransition] = useTransition();

  function choose(next: RequirementStatus) {
    if (next === value) return;
    const prev = value;
    setValue(next);
    startTransition(async () => {
      const res = await setRequirementStatus(id, next);
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
          requirementStatusBadgeClass(value),
          pending && "opacity-60",
        )}
      >
        <span className="truncate">{requirementStatusLabel(value)}</span>
        <ChevronDown className="size-3 shrink-0 opacity-80" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-44"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuGroup>
          {REQUIREMENT_STATUSES.map((o) => (
            <DropdownMenuItem
              key={o.value}
              onClick={() => choose(o.value)}
              className="gap-2"
            >
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  statusDotClass(o.value),
                )}
              />
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

function matches(r: RequirementWithVendor, q: string): boolean {
  const haystack = [r.title, r.skills, r.location, r.vendor_name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function RequirementsTable({
  requirements,
  isAdmin,
}: {
  requirements: RequirementWithVendor[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return requirements;
    return requirements.filter((r) => matches(r, q));
  }, [requirements, query]);

  if (requirements.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Briefcase className="size-6" />
          </div>
          <p className="font-medium">No requirements yet</p>
          <p className="text-sm text-muted-foreground">
            Add your first requirement to get started.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-admin={isAdmin}>
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, skills, location, vendor"
          className="pl-8"
        />
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-muted-foreground"
                >
                  No matches
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/requirements/${r.id}`)}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{r.title}</span>
                      {r.vendor_name || r.end_client ? (
                        <span className="text-xs text-muted-foreground">
                          {[r.vendor_name, r.end_client]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span>{r.location ?? "—"}</span>
                      {r.remote ? (
                        <Badge variant="outline">Remote</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.rate != null ? `$${r.rate}/hr` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={priorityBadgeClass(r.priority)}>
                      {requirementPriorityLabel(r.priority)}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <RequirementStatusSelect id={r.id} status={r.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export function DeleteRequirementButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const res = await deleteRequirement(id);
      // deleteRequirement redirects on success; only returns on error.
      if (res && "error" in res) {
        toast.error(res.error);
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="outline" className="text-destructive">
            <Trash2 />
            Delete
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete requirement?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the requirement. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={onConfirm}
            className={cn("bg-destructive text-white hover:bg-destructive/90")}
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Eye,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import type { Candidate, CoordinatorOption } from "@/lib/candidates";
import { stageLabel } from "@/lib/candidate-constants";
import { cn } from "@/lib/utils";
import { reassignCandidate, deleteCandidate } from "./actions";
import { StatusSelect } from "./status-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Inline coordinator reassignment for the candidates table (admins only).
function CoordinatorSelect({
  candidateId,
  current,
  coordinators,
}: {
  candidateId: string;
  current: string;
  coordinators: CoordinatorOption[];
}) {
  const router = useRouter();
  const [value, setValue] = useState<string | null>(current || null);
  const [pending, startTransition] = useTransition();

  const label =
    coordinators.find((c) => c.id === value)?.name ?? "Unassigned";

  function choose(next: string) {
    if (next === value) return;
    const prev = value;
    setValue(next);
    startTransition(async () => {
      const res = await reassignCandidate(candidateId, next);
      if (res && "error" in res) {
        toast.error(res.error);
        setValue(prev);
        return;
      }
      toast.success("Reassigned");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "inline-flex w-40 items-center justify-between gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring",
          pending && "opacity-60",
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="size-3 shrink-0 opacity-80" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-72 w-48 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuGroup>
          {coordinators.map((c) => (
            <DropdownMenuItem
              key={c.id}
              onClick={() => choose(c.id)}
              className="gap-2"
            >
              <span className="flex-1 truncate">{c.name}</span>
              {c.id === value ? (
                <Check className="size-3.5 text-muted-foreground" />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Per-row "..." actions menu: view details, edit, docs, or delete the candidate.
// stopPropagation keeps clicks off the row's navigate-to-detail handler. The delete
// confirm dialog lives outside the menu (controlled by deleteOpen) because Base UI
// unmounts the menu's portal on close — a dialog nested in a menu item would break.
function RowActions({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  function onDelete() {
    startTransition(async () => {
      // deleteCandidate revalidates /candidates and redirects; only returns on error.
      const res = await deleteCandidate(id);
      if (res && "error" in res) toast.error(res.error);
    });
  }

  return (
    <div
      className="flex items-center justify-end"
      onClick={(e) => e.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              title="Actions"
              aria-label={`Actions for ${name}`}
            >
              <MoreHorizontal />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem render={<Link href={`/candidates/${id}`} />}>
            <Eye />
            View details
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={`/candidates/${id}/edit`} />}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            render={<Link href={`/candidates/${id}?tab=documents`} />}
          >
            <FileText />
            Documents
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete candidate?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes “{name}”. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={onDelete}
              className={cn("bg-destructive text-white hover:bg-destructive/90")}
            >
              {pending ? <Loader2 className="animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function matches(c: Candidate, q: string): boolean {
  const haystack = [
    c.full_name,
    c.primary_skills,
    c.visa,
    c.location,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function CandidatesTable({
  candidates,
  coordinators,
  isAdmin,
}: {
  candidates: Candidate[];
  coordinators: CoordinatorOption[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => matches(c, q));
  }, [candidates, query]);

  if (candidates.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Users className="size-6" />
          </div>
          <p className="font-medium">No candidates yet</p>
          <p className="text-sm text-muted-foreground">
            Add your first candidate to get started.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, skills, visa, location"
          className="pl-8"
        />
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              {/* w-full makes Name greedy: it absorbs the table's leftover width so
                  the other columns pack tight and no dead gap forms before Actions. */}
              <TableHead className="w-full">Name</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Visa</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Coordinator</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-muted-foreground"
                >
                  No matches
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/candidates/${c.id}`)}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{c.full_name}</span>
                      {c.current_company ? (
                        <span className="text-xs text-muted-foreground">
                          {c.current_company}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {c.rate != null ? `$${c.rate}/hr` : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span>{c.visa ?? "—"}</span>
                      {c.visa_transfer ? (
                        <Badge variant="outline">H1T</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{c.location ?? "—"}</TableCell>
                  <TableCell
                    className="whitespace-nowrap"
                    onClick={isAdmin ? (e) => e.stopPropagation() : undefined}
                  >
                    {isAdmin ? (
                      <CoordinatorSelect
                        candidateId={c.id}
                        current={c.assigned_coordinator_id ?? ""}
                        coordinators={coordinators}
                      />
                    ) : (
                      <span className="text-muted-foreground">
                        {c.coordinator?.full_name ??
                          c.coordinator?.email ??
                          "—"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <StatusSelect id={c.id} status={c.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {stageLabel(c.pipeline_stage)}
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions id={c.id} name={c.full_name} />
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

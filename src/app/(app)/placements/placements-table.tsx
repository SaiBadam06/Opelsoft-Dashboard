"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Award,
  Check,
  ChevronDown,
  MoreHorizontal,
  Search,
  Trash2,
} from "lucide-react";

import type { PlacementRow } from "@/lib/placements";
import {
  PLACEMENT_STATUSES,
  placementStatusBadgeClass,
  placementStatusLabel,
  type PlacementStatus,
} from "@/lib/work-constants";
import {
  deletePlacement,
  setPlacementStatus,
} from "@/app/(app)/placements/actions";
import { cn } from "@/lib/utils";
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

function matches(p: PlacementRow, q: string): boolean {
  const haystack = [p.candidate_name, p.vendor_name, p.end_client, p.recruiter]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

// Inline, fully-styled status editor for the placements table.
function PlacementStatusSelect({
  id,
  status,
}: {
  id: string;
  status: PlacementStatus;
}) {
  const router = useRouter();
  const [value, setValue] = useState<PlacementStatus>(status);
  const [pending, startTransition] = useTransition();

  function choose(next: PlacementStatus) {
    if (next === value) return;
    const prev = value;
    setValue(next);
    startTransition(async () => {
      const res = await setPlacementStatus(id, next);
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
          placementStatusBadgeClass(value),
          pending && "opacity-60",
        )}
      >
        <span className="truncate">{placementStatusLabel(value)}</span>
        <ChevronDown className="size-3 shrink-0 opacity-80" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-44"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuGroup>
          {PLACEMENT_STATUSES.map((o) => (
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

function PlacementRowActions({ placement }: { placement: PlacementRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const label = placement.candidate_name ?? "this placement";

  function confirmDelete() {
    startTransition(async () => {
      const res = await deletePlacement(placement.id);
      if (res && "error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Placement removed");
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
              aria-label="Placement actions"
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
            <AlertDialogTitle>Delete placement?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the placement for {label}. This cannot be
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

export function PlacementsTable({
  placements,
  isAdmin,
}: {
  placements: PlacementRow[];
  isAdmin: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return placements;
    return placements.filter((p) => matches(p, q));
  }, [placements, query]);

  if (placements.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Award className="size-6" />
          </div>
          <p className="font-medium">No placements yet</p>
          <p className="text-sm text-muted-foreground">
            Add a placement once a consultant lands a project.
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
          placeholder="Search candidate, vendor, client, recruiter"
          className="pl-8"
        />
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Candidate</TableHead>
              <TableHead>Vendor / Client</TableHead>
              <TableHead>Recruiter</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Placed</TableHead>
              <TableHead>In / Out</TableHead>
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
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.candidate_name ?? DASH}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{p.vendor_name ?? DASH}</span>
                      {p.end_client ? (
                        <span className="text-xs text-muted-foreground">
                          {p.end_client}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{p.recruiter ?? DASH}</TableCell>
                  <TableCell>
                    {p.rate != null ? `$${p.rate}/hr` : DASH}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {p.placement_date
                      ? new Date(p.placement_date).toLocaleDateString()
                      : DASH}
                  </TableCell>
                  <TableCell>{p.in_out ?? DASH}</TableCell>
                  <TableCell>
                    <PlacementStatusSelect id={p.id} status={p.status} />
                  </TableCell>
                  {isAdmin ? (
                    <TableCell className="text-right">
                      <PlacementRowActions placement={p} />
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

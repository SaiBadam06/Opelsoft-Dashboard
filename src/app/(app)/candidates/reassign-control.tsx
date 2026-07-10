"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { reassignCandidate, deleteCandidate } from "./actions";

type Coordinator = { id: string; name: string };

export function ReassignControl({
  candidateId,
  currentCoordinatorId,
  coordinators,
}: {
  candidateId: string;
  currentCoordinatorId: string | null;
  coordinators: Coordinator[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string>(currentCoordinatorId ?? "");

  const unchanged = selected === (currentCoordinatorId ?? "");

  function onSave() {
    startTransition(async () => {
      const res = await reassignCandidate(candidateId, selected);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Reassigned");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={selected}
        onValueChange={(value) => setSelected((value as string | null) ?? "")}
      >
        <SelectTrigger className="w-full sm:w-64">
          <SelectValue placeholder="Select coordinator">
            {(value) =>
              coordinators.find((c) => c.id === value)?.name ?? "Select coordinator"
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {coordinators.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button onClick={onSave} disabled={pending || unchanged || selected === ""}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Save
      </Button>
    </div>
  );
}

export function DeleteCandidateButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const res = await deleteCandidate(id);
      // deleteCandidate redirects on success; only returns on error.
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
          <AlertDialogTitle>Delete candidate?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the candidate. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={onConfirm}
            className={cn(
              "bg-destructive text-white hover:bg-destructive/90",
            )}
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { setStatus } from "./actions";
import {
  STATUS_OPTIONS,
  statusBadgeClass,
  statusLabel,
  type CandidateStatus,
} from "@/lib/candidate-constants";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function statusDotClass(status: CandidateStatus): string {
  switch (status) {
    case "available":
      return "bg-success";
    case "interviewing":
    case "submitted":
      return "bg-info";
    case "offered":
      return "bg-warning";
    case "placed":
      return "bg-primary";
    case "rejected":
      return "bg-destructive";
    default:
      return "bg-muted-foreground";
  }
}

// Inline, fully-styled status editor for the candidates table.
export function StatusSelect({
  id,
  status,
}: {
  id: string;
  status: CandidateStatus;
}) {
  const router = useRouter();
  const [value, setValue] = useState<CandidateStatus>(status);
  const [pending, startTransition] = useTransition();

  function choose(next: CandidateStatus) {
    if (next === value) return;
    const prev = value;
    setValue(next);
    startTransition(async () => {
      const res = await setStatus(id, next);
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
          statusBadgeClass(value),
          pending && "opacity-60",
        )}
      >
        <span className="truncate">{statusLabel(value)}</span>
        <ChevronDown className="size-3 shrink-0 opacity-80" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-44"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuGroup>
          {STATUS_OPTIONS.map((o) => (
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

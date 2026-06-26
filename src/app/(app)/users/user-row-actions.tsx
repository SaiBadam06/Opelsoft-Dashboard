"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, ShieldCheck, UserCog, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteUser, updateUserRole } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

type Role = "admin" | "coordinator";

export function UserRowActions({
  userId,
  email,
  role,
  isSelf,
}: {
  userId: string;
  email: string;
  role: Role;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isSelf) {
    return <span className="text-xs text-muted-foreground">You</span>;
  }

  const nextRole: Role = role === "admin" ? "coordinator" : "admin";

  function changeRole() {
    startTransition(async () => {
      const res = await updateUserRole(userId, nextRole);
      if (res && "error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`${email} is now ${nextRole}`);
      router.refresh();
    });
  }

  function confirmDelete() {
    startTransition(async () => {
      const res = await deleteUser(userId);
      if (res && "error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Removed ${email}`);
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
              aria-label="User actions"
              disabled={pending}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={changeRole}>
            {nextRole === "admin" ? <ShieldCheck /> : <UserCog />}
            Make {nextRole}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 />
            Delete user
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {email}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes their account and access. This action
              cannot be undone.
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

"use client";

import { useActionState, useEffect } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { inviteUser } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteUser, null);

  useEffect(() => {
    if (!state) return;
    if ("ok" in state && state.ok) {
      toast.success("Invitation sent");
    } else if ("error" in state && state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required className="w-64" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          name="role"
          className="h-9 rounded-md border bg-background px-3 text-sm"
          defaultValue="coordinator"
        >
          <option value="coordinator">Coordinator</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Inviting…
          </>
        ) : (
          <>
            <UserPlus />
            Send invite
          </>
        )}
      </Button>
    </form>
  );
}

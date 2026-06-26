"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Copy, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { inviteUser } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SetupInfo = { email: string; setupLink: string; reused: boolean };

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteUser, null);
  const [setup, setSetup] = useState<SetupInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!state) return;
    if ("ok" in state && state.ok) {
      setSetup({
        email: state.email,
        setupLink: state.setupLink,
        reused: state.reused,
      });
      setCopied(false);
      toast.success(
        state.reused
          ? `${state.email} already exists — new setup link generated`
          : `Account created for ${state.email}`,
      );
    } else if ("error" in state && state.error) {
      toast.error(state.error);
    }
  }, [state]);

  async function copyLink() {
    if (!setup) return;
    await navigator.clipboard.writeText(setup.setupLink);
    setCopied(true);
    toast.success("Setup link copied");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="teammate@opelsoft.com"
            className="w-64"
          />
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
              Generating…
            </>
          ) : (
            <>
              <UserPlus />
              Create &amp; get link
            </>
          )}
        </Button>
      </form>

      {setup && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
          <p className="text-sm font-medium">
            Setup link for {setup.email}
          </p>
          <p className="text-xs text-muted-foreground">
            Share this link with them. Opening it lets them set a password and
            finish creating their account.
          </p>
          <div className="flex items-center gap-2">
            <Input readOnly value={setup.setupLink} className="font-mono text-xs" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={copyLink}
              aria-label="Copy setup link"
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

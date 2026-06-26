"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Copy, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { inviteUser } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SetupInfo = {
  email: string;
  setupLink: string | null;
  reused: boolean;
  emailed: boolean;
};

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteUser, null);
  const [copied, setCopied] = useState(false);

  // Derived from the action result — no need to mirror it into state.
  const setup: SetupInfo | null =
    state && "ok" in state && state.ok
      ? {
          email: state.email,
          setupLink: state.setupLink,
          reused: state.reused,
          emailed: state.emailed,
        }
      : null;

  // Toast is an external side effect (allowed in an effect); it fires once per
  // new action result.
  useEffect(() => {
    if (!state) return;
    if ("ok" in state && state.ok) {
      toast.success(
        state.emailed
          ? `Invitation email sent to ${state.email}`
          : `Email couldn't be sent — share the setup link below`,
      );
    } else if ("error" in state && state.error) {
      toast.error(state.error);
    }
  }, [state]);

  async function copyLink() {
    if (!setup?.setupLink) return;
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
              Sending…
            </>
          ) : (
            <>
              <UserPlus />
              Send invite
            </>
          )}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Invites are limited to <span className="font-medium">@personaon.com</span>{" "}
        and <span className="font-medium">@opelsoft.com</span> addresses.
      </p>

      {setup && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
          <p className="text-sm font-medium">
            {setup.emailed
              ? `Invitation email sent to ${setup.email}`
              : `Setup link for ${setup.email}`}
          </p>
          <p className="text-xs text-muted-foreground">
            {setup.emailed
              ? "They'll get an email to set a password. Or share this backup link directly:"
              : "Email delivery isn't set up yet — share this link so they can set a password:"}
          </p>
          {setup.setupLink && (
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={setup.setupLink}
                className="font-mono text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
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
          )}
        </div>
      )}
    </div>
  );
}

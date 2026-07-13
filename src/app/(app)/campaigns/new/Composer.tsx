"use client";

import { useActionState, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { VendorOption } from "@/lib/vendors";
import { spamCheck } from "@/lib/email/spamCheck";
import { createAndStartCampaign } from "../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function VendorMultiSelect({
  vendors,
  selected,
  onToggle,
}: {
  vendors: VendorOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (vendors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No vendors with an email on file.</p>
    );
  }
  return (
    <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-md border p-2">
      {vendors.map((v) => (
        <label
          key={v.id}
          className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted"
        >
          <input
            type="checkbox"
            className="size-4 rounded border accent-primary"
            checked={selected.has(v.id)}
            onChange={() => onToggle(v.id)}
          />
          <span className="font-medium">{v.name}</span>
          <span className="text-muted-foreground">{v.email}</span>
        </label>
      ))}
    </div>
  );
}

export function Composer({
  vendors,
  sendingAs,
  defaultReplyTo,
}: {
  vendors: VendorOption[];
  sendingAs: string;
  defaultReplyTo: string;
}) {
  const [state, formAction, pending] = useActionState(createAndStartCampaign, null);
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");

  const spam = useMemo(() => spamCheck({ subject, html: bodyHtml }), [subject, bodyHtml]);

  function toggleVendor(id: string) {
    setSelectedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="vendor_ids" value={[...selectedVendors].join(",")} />

      <Card>
        <CardHeader>
          <CardTitle>Campaign</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="name">
              Campaign name <span className="text-destructive">*</span>
            </Label>
            <Input id="name" name="name" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>From</Label>
            <p className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm">
              {sendingAs}
            </p>
            <p className="text-xs text-muted-foreground">
              Campaigns send from your account&apos;s mailbox automatically.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reply_to">Reply-To</Label>
            <Input id="reply_to" name="reply_to" type="email" defaultValue={defaultReplyTo} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recipients</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Vendors</Label>
            <VendorMultiSelect vendors={vendors} selected={selectedVendors} onToggle={toggleVendor} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="manual">Paste addresses</Label>
            <Textarea
              id="manual"
              name="manual"
              placeholder="One address per line, or comma/space separated"
              rows={4}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="file">Upload spreadsheet</Label>
            <Input id="file" name="file" type="file" accept=".xlsx,.xls,.csv" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Message</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="subject">
              Subject <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subject"
              name="subject"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="body_html">
              Body (HTML) <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="body_html"
              name="body_html"
              required
              rows={12}
              className="font-mono text-xs"
              placeholder={"<p>Hi {{contact_name}},</p>\n<p>Reaching out from {{vendor_name}}'s partner list...</p>"}
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Preview</Label>
            <div
              className="min-h-24 rounded-md border bg-background p-3 text-sm"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </div>

          <div className="flex flex-col gap-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Spam check</span>
              <span className="text-xs text-muted-foreground">Score: {spam.score}</span>
            </div>
            {spam.warnings.length === 0 ? (
              <p className="text-xs text-muted-foreground">No issues detected.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {spam.warnings.map((w, i) => (
                  <li
                    key={i}
                    className={cn(
                      "text-xs",
                      w.severity === "high" ? "font-medium text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {w.message}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              These are warnings only — you can still send.
            </p>
          </div>
        </CardContent>
      </Card>

      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className={cn("animate-spin")} />
              Creating…
            </>
          ) : (
            "Create & start sending"
          )}
        </Button>
      </div>
    </form>
  );
}

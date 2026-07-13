"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play } from "lucide-react";

import type { CampaignStatus } from "@/lib/campaigns";
import { setCampaignStatus } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const POLL_MS = 15_000;

export function Progress({
  id,
  initialStatus,
  total,
  sent,
  failed,
}: {
  id: string;
  initialStatus: CampaignStatus;
  total: number;
  sent: number;
  failed: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Keep the page fresh while the drain endpoint is actively working through
  // this campaign. Stops polling automatically once status leaves "sending".
  useEffect(() => {
    if (initialStatus !== "sending") return;
    const interval = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(interval);
  }, [initialStatus, router]);

  const done = sent + failed;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  function toggle(next: "sending" | "paused") {
    startTransition(async () => {
      await setCampaignStatus(id, next);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {done} / {total} processed ({pct}%) · {sent} sent · {failed} failed
          </p>
          {initialStatus === "sending" ? (
            <Button variant="outline" size="sm" disabled={pending} onClick={() => toggle("paused")}>
              <Pause />
              Pause
            </Button>
          ) : initialStatus === "paused" ? (
            <Button variant="outline" size="sm" disabled={pending} onClick={() => toggle("sending")}>
              <Play />
              Resume
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Sending runs on the server every minute — you can close this page.
        </p>
      </CardContent>
    </Card>
  );
}

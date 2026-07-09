"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  ScreeningDetails,
  eligibilityClass,
} from "@/components/shared/screening-details";
import { scoreCandidateAction } from "@/app/(app)/requirements/screening-actions";
import type { CandidateScreeningRow } from "@/lib/screenings";

export function CandidateScreenings({
  candidateId,
  screenings,
  requirements,
}: {
  candidateId: string;
  screenings: CandidateScreeningRow[];
  requirements: { id: string; title: string }[];
}) {
  const [pending, start] = useTransition();
  const [reqId, setReqId] = useState("");
  const router = useRouter();

  function run() {
    if (!reqId) {
      toast.error("Pick a requirement first.");
      return;
    }
    start(async () => {
      const res = await scoreCandidateAction(candidateId, reqId);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Scored ${res.score}/100 for this requirement.`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={reqId}
          onChange={(e) => setReqId(e.target.value)}
          disabled={pending}
          className="h-9 min-w-56 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Score against a requirement…</option>
          {requirements.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
        <Button onClick={run} disabled={pending || !reqId}>
          {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {pending ? "Scoring…" : "Score fit"}
        </Button>
      </div>

      {screenings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No fit scores yet. Pick a requirement above and score this candidate
          against it.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {screenings.map((s) => (
            <li key={s.id} className="rounded-lg border">
              <details className="group [&_summary]:cursor-pointer">
                <summary className="flex items-center gap-3 p-3 select-none">
                  <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-md bg-muted text-sm font-semibold">
                    {s.score}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/requirements/${s.requirement_id}`}
                        className="truncate font-medium hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {s.requirement_title ?? "Requirement"}
                      </Link>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${eligibilityClass(s.eligibility)}`}
                      >
                        {s.eligibility}
                      </span>
                    </span>
                    <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {s.reason}
                    </span>
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>

                <ScreeningDetails
                  reason={s.reason}
                  breakdown={s.score_breakdown}
                  matches={s.requirement_matches}
                />
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

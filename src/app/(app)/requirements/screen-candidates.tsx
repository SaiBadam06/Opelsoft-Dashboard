"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  ScreeningDetails,
  eligibilityClass,
} from "@/components/shared/screening-details";
import { screenCandidatesAction } from "./screening-actions";
import type { ScreeningRow } from "@/lib/screenings";

export function ScreenCandidates({
  requirementId,
  screenings,
}: {
  requirementId: string;
  screenings: ScreeningRow[];
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function run() {
    // One Gemini call per candidate — confirm before spending the daily quota.
    if (
      !window.confirm(
        "Score every candidate against this requirement? This runs one AI call per candidate and counts toward the daily quota.",
      )
    )
      return;
    start(async () => {
      const res = await screenCandidatesAction(requirementId);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Scored ${res.scored} candidate${res.scored === 1 ? "" : "s"}` +
          (res.failed ? ` (${res.failed} failed)` : ""),
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          AI-scores every candidate against this requirement (skills,
          experience, education) from their profile.
        </p>
        <Button onClick={run} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {pending
            ? "Scoring…"
            : screenings.length
              ? "Re-score"
              : "Screen candidates"}
        </Button>
      </div>

      {screenings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No screenings yet. Click “Screen candidates” to rank your bench for
          this role.
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
                        href={`/candidates/${s.candidate_id}`}
                        className="truncate font-medium hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {s.candidate_name ?? "Candidate"}
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

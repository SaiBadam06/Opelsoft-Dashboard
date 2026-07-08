import { ChevronDown } from "lucide-react";
import type { RequirementMatch, ScoreBreakdown } from "@/lib/ai/score-candidate";

export function eligibilityClass(e: string): string {
  const s = e.toLowerCase();
  if (s.startsWith("eligible"))
    return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  if (s.startsWith("partial"))
    return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  return "bg-rose-500/15 text-rose-600 dark:text-rose-400";
}

function verdictPillClass(v: string): string {
  if (v === "Strong")
    return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  if (v === "Partial")
    return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

function VerdictPill({ verdict }: { verdict: string }) {
  return (
    <span
      className={`inline-flex w-16 shrink-0 justify-center rounded px-1.5 py-0.5 text-[11px] font-medium ${verdictPillClass(verdict)}`}
    >
      {verdict}
    </span>
  );
}

function tally(ms: RequirementMatch[]) {
  const c = { Strong: 0, Partial: 0, Missing: 0 } as Record<string, number>;
  for (const m of ms) c[m.verdict] = (c[m.verdict] ?? 0) + 1;
  return c;
}

// One collapsible group of requirement matches (e.g. Required / Nice-to-have).
function MatchGroup({
  title,
  sub,
  matches,
  score,
  defaultOpen,
}: {
  title: string;
  sub?: string;
  matches: RequirementMatch[];
  score?: { points: number; max: number };
  defaultOpen?: boolean;
}) {
  if (matches.length === 0) return null;
  const c = tally(matches);
  return (
    <details open={defaultOpen} className="group/acc rounded-lg border bg-muted/20">
      <summary className="flex cursor-pointer items-center gap-2 p-2.5 select-none">
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open/acc:rotate-180" />
        <span className="text-xs font-semibold uppercase tracking-wide">
          {title}
          {sub ? (
            <span className="ml-1 font-normal normal-case text-muted-foreground">
              ({sub})
            </span>
          ) : null}
        </span>
        {score ? (
          <span className="rounded bg-background px-1.5 py-0.5 text-[11px] font-medium tabular-nums">
            {score.points}/{score.max}
          </span>
        ) : null}
        <span className="ml-auto hidden text-[11px] text-muted-foreground sm:inline">
          {c.Strong} strong · {c.Partial} partial · {c.Missing} missing
        </span>
      </summary>
      <ul className="divide-y divide-border/50 border-t bg-background">
        {matches.map((m, i) => (
          <li key={i} className="flex gap-2 p-2">
            <VerdictPill verdict={m.verdict} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium leading-snug">{m.requirement}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {m.evidence}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

// The expandable body of one ATS screening — the per-requirement evidence
// matrix grouped into collapsible cards. Shared by both screening views.
export function ScreeningDetails({
  reason,
  breakdown,
  matches,
}: {
  reason: string;
  breakdown: ScoreBreakdown[];
  matches: RequirementMatch[];
}) {
  const required = matches.filter((m) => m.type === "Required");
  const nice = matches.filter((m) => m.type === "Nice-to-have");
  const other = matches.filter(
    (m) => m.type === "Experience" || m.type === "Education",
  );

  const cat = (n: string) =>
    breakdown.find((b) => b.category.toLowerCase().includes(n));
  const reqCat = cat("required");
  const niceCat = cat("nice");
  const exp = cat("experience");
  const edu = cat("education");
  const otherScore =
    exp || edu
      ? {
          points: (exp?.points ?? 0) + (edu?.points ?? 0),
          max: (exp?.max ?? 0) + (edu?.max ?? 0),
        }
      : undefined;

  return (
    <div className="space-y-2 border-t p-3 text-sm">
      <p className="text-muted-foreground">{reason}</p>

      <MatchGroup
        title="Required"
        sub="primary"
        matches={required}
        score={reqCat ? { points: reqCat.points, max: reqCat.max } : undefined}
        defaultOpen
      />
      <MatchGroup
        title="Nice-to-have"
        sub="secondary"
        matches={nice}
        score={niceCat ? { points: niceCat.points, max: niceCat.max } : undefined}
      />
      <MatchGroup
        title="Experience & education"
        matches={other}
        score={otherScore}
      />
    </div>
  );
}

# Submission Logs Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only "Submission Logs" tab that lists every submission status change with candidate/status/date filters.

**Architecture:** A new `/logs` server-component route reads filters from URL search params, calls a new `listStatusLogs()` data function that queries `submission_status_history` (inner-joined to submissions→candidates), and renders a filter bar (client) + results table. A pure `parseLogFilters()` helper normalizes/validates search params and is unit-tested.

**Tech Stack:** Next.js (app router, this repo's modified build), React server + client components, Supabase (PostgREST), Tailwind + shadcn UI, Vitest.

> **Prerequisite (not a code task):** Migration `0007_submission_status_pipeline.sql` must be applied to the database, or `submission_status_history` will not exist and the page shows an empty state.

> **Note on commits:** The user asked that nothing be committed until they say so. Keep the commit step in each task for completeness, but SKIP running `git commit` until the user approves. Stage/verify only.

---

## File Structure

- `src/lib/submissions.ts` — add `StatusLogRow`, `LogFilters`, pure `parseLogFilters()`, and `listStatusLogs()`.
- `src/lib/submissions.test.ts` (new) — unit tests for `parseLogFilters()`.
- `src/lib/roles.ts` — add the "Submission Logs" nav item.
- `src/lib/roles.test.ts` — add a test asserting the logs nav item is admin-only.
- `src/components/app-shell/sidebar.tsx` — add `/logs` → `ScrollText` icon mapping.
- `src/app/(app)/logs/page.tsx` (new) — admin-guarded route.
- `src/app/(app)/logs/logs-filters.tsx` (new) — client filter bar.

---

### Task 1: Data layer — filter parsing + query

**Files:**
- Modify: `src/lib/submissions.ts`
- Test: `src/lib/submissions.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/submissions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseLogFilters } from "@/lib/submissions";

describe("parseLogFilters", () => {
  it("returns empty object when no params", () => {
    expect(parseLogFilters({})).toEqual({});
  });

  it("keeps a valid status", () => {
    expect(parseLogFilters({ status: "placed" })).toEqual({ status: "placed" });
  });

  it("drops an invalid status", () => {
    expect(parseLogFilters({ status: "bogus" })).toEqual({});
  });

  it("keeps candidate, from, to", () => {
    expect(
      parseLogFilters({ candidate: "abc", from: "2026-01-01", to: "2026-02-01" }),
    ).toEqual({ candidate: "abc", from: "2026-01-01", to: "2026-02-01" });
  });

  it("takes the first value when a param is an array", () => {
    expect(parseLogFilters({ status: ["submitted", "placed"] })).toEqual({
      status: "submitted",
    });
  });

  it("ignores empty strings", () => {
    expect(parseLogFilters({ candidate: "", status: "" })).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/submissions.test.ts`
Expected: FAIL — `parseLogFilters` is not exported.

- [ ] **Step 3: Implement `parseLogFilters`, `LogFilters`, `StatusLogRow`, `listStatusLogs`**

Append to `src/lib/submissions.ts` (imports `SUBMISSION_STATUSES` — add it to the existing top import from `@/lib/job-constants`, which currently imports only the types):

```ts
import { SUBMISSION_STATUSES } from "@/lib/job-constants";

export interface LogFilters {
  candidate?: string;
  status?: SubmissionStatus;
  from?: string;
  to?: string;
}

function first(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  const t = (s ?? "").trim();
  return t === "" ? undefined : t;
}

export function parseLogFilters(
  sp: Record<string, string | string[] | undefined>,
): LogFilters {
  const out: LogFilters = {};
  const candidate = first(sp.candidate);
  if (candidate) out.candidate = candidate;

  const status = first(sp.status);
  if (status && SUBMISSION_STATUSES.some((o) => o.value === status)) {
    out.status = status as SubmissionStatus;
  }

  const from = first(sp.from);
  if (from) out.from = from;
  const to = first(sp.to);
  if (to) out.to = to;
  return out;
}

export interface StatusLogRow {
  id: string;
  submission_id: string;
  candidate_name: string | null;
  from_status: SubmissionStatus | null;
  to_status: SubmissionStatus;
  changed_by_name: string | null;
  changed_at: string;
}

type JoinedLog = {
  id: string;
  from_status: SubmissionStatus | null;
  to_status: SubmissionStatus;
  changed_by_name: string | null;
  changed_at: string;
  submissions: {
    id: string;
    candidate_id: string | null;
    candidates: { full_name: string } | null;
  } | null;
};

export async function listStatusLogs(
  filters: LogFilters = {},
): Promise<StatusLogRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("submission_status_history")
    .select(
      "id, from_status, to_status, changed_by_name, changed_at, submissions!inner(id, candidate_id, candidates(full_name))",
    )
    .order("changed_at", { ascending: false })
    .limit(500);

  if (filters.status) q = q.eq("to_status", filters.status);
  if (filters.candidate)
    q = q.eq("submissions.candidate_id", filters.candidate);
  if (filters.from) q = q.gte("changed_at", filters.from);
  if (filters.to) q = q.lte("changed_at", `${filters.to}T23:59:59.999Z`);

  const { data } = await q;
  return ((data as unknown as JoinedLog[] | null) ?? []).map((r) => ({
    id: r.id,
    submission_id: r.submissions?.id ?? "",
    candidate_name: r.submissions?.candidates?.full_name ?? null,
    from_status: r.from_status,
    to_status: r.to_status,
    changed_by_name: r.changed_by_name,
    changed_at: r.changed_at,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/submissions.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit** *(stage only — do not commit until user approves)*

```bash
git add src/lib/submissions.ts src/lib/submissions.test.ts
# git commit -m "feat: add submission status log query + filter parsing"
```

---

### Task 2: Navigation item + icon

**Files:**
- Modify: `src/lib/roles.ts`
- Modify: `src/lib/roles.test.ts`
- Modify: `src/components/app-shell/sidebar.tsx`

- [ ] **Step 1: Write the failing test**

Add to the `NAV_ITEMS` describe block in `src/lib/roles.test.ts`:

```ts
  it("includes a Submission Logs item restricted to admin", () => {
    const logs = NAV_ITEMS.find((i) => i.href === "/logs");
    expect(logs?.label).toBe("Submission Logs");
    expect(logs?.minRole).toBe("admin");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/roles.test.ts`
Expected: FAIL — no `/logs` item.

- [ ] **Step 3: Add the nav item**

In `src/lib/roles.ts`, add to `NAV_ITEMS` immediately before the `Users` entry:

```ts
  { label: "Submission Logs", href: "/logs", minRole: "admin" },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/roles.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the icon mapping**

In `src/components/app-shell/sidebar.tsx`: add `ScrollText` to the `lucide-react` import list, and add to `ICON_MAP`:

```ts
  "/logs": ScrollText,
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit** *(stage only)*

```bash
git add src/lib/roles.ts src/lib/roles.test.ts src/components/app-shell/sidebar.tsx
# git commit -m "feat: add Submission Logs nav item + icon"
```

---

### Task 3: Filter bar (client component)

**Files:**
- Create: `src/app/(app)/logs/logs-filters.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { SUBMISSION_STATUSES } from "@/lib/job-constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const selectClassName = "h-9 rounded-md border bg-background px-3 text-sm";

export function LogsFilters({
  candidates,
}: {
  candidates: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/logs?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-candidate">Candidate</Label>
        <select
          id="f-candidate"
          className={selectClassName}
          value={sp.get("candidate") ?? ""}
          onChange={(e) => setParam("candidate", e.target.value)}
        >
          <option value="">All candidates</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-status">Status</Label>
        <select
          id="f-status"
          className={selectClassName}
          value={sp.get("status") ?? ""}
          onChange={(e) => setParam("status", e.target.value)}
        >
          <option value="">All statuses</option>
          {SUBMISSION_STATUSES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-from">From</Label>
        <Input
          id="f-from"
          type="date"
          value={sp.get("from") ?? ""}
          onChange={(e) => setParam("from", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-to">To</Label>
        <Input
          id="f-to"
          type="date"
          value={sp.get("to") ?? ""}
          onChange={(e) => setParam("to", e.target.value)}
        />
      </div>

      {sp.toString() ? (
        <Button variant="outline" onClick={() => router.push("/logs")}>
          Clear
        </Button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit** *(stage only)*

```bash
git add "src/app/(app)/logs/logs-filters.tsx"
# git commit -m "feat: add submission logs filter bar"
```

---

### Task 4: Logs page (admin-guarded route)

**Files:**
- Create: `src/app/(app)/logs/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { candidateOptions } from "@/lib/candidates";
import { listStatusLogs, parseLogFilters } from "@/lib/submissions";
import {
  submissionStatusLabel,
  submissionStatusBadgeClass,
} from "@/lib/job-constants";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogsFilters } from "./logs-filters";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const filters = parseLogFilters(sp);

  const [candidates, logs] = await Promise.all([
    candidateOptions(),
    listStatusLogs(filters),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Submission Logs</h1>
        <p className="text-sm text-muted-foreground">
          Every submission status change, newest first.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <LogsFilters candidates={candidates} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No status changes match these filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Candidate</th>
                    <th className="py-2 pr-4 font-medium">Change</th>
                    <th className="py-2 pr-4 font-medium">By</th>
                    <th className="py-2 pr-4 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        {l.submission_id ? (
                          <Link
                            href={`/submissions/${l.submission_id}`}
                            className="hover:underline"
                          >
                            {l.candidate_name ?? "—"}
                          </Link>
                        ) : (
                          (l.candidate_name ?? "—")
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        <span className="flex items-center gap-2">
                          {l.from_status ? (
                            <>
                              <Badge
                                className={submissionStatusBadgeClass(
                                  l.from_status,
                                )}
                              >
                                {submissionStatusLabel(l.from_status)}
                              </Badge>
                              <span className="text-muted-foreground">→</span>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              created
                            </span>
                          )}
                          <Badge
                            className={submissionStatusBadgeClass(l.to_status)}
                          >
                            {submissionStatusLabel(l.to_status)}
                          </Badge>
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {l.changed_by_name ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {formatDateTime(l.changed_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint "src/app/(app)/logs/**"`
Expected: no errors.

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: build succeeds; `/logs` route compiles.

- [ ] **Step 4: Commit** *(stage only)*

```bash
git add "src/app/(app)/logs/page.tsx"
# git commit -m "feat: add admin-only Submission Logs page"
```

---

### Task 5: Manual verification

- [ ] **Step 1: Confirm prerequisite** — migration `0007` applied (`submission_status_history` exists). If not, apply it first.

- [ ] **Step 2: Run the app**

Run: `npm run dev`

- [ ] **Step 3: As admin (`admin@opelsoft.test`)**
  - "Submission Logs" appears in the sidebar.
  - `/logs` lists status changes, newest first.
  - Filter by candidate, status, from, to — each narrows results; "Clear" resets.
  - A row's candidate links to `/submissions/[id]`.
  - Change a submission's status elsewhere, return to `/logs` → the new entry appears.

- [ ] **Step 4: As coordinator (`deekshith@personaon.com`)**
  - No "Submission Logs" item in the sidebar.
  - Visiting `/logs` directly redirects to `/dashboard`.

---

## Self-Review Notes

- **Spec coverage:** nav item (Task 2), admin guard (Task 4 `requireAdmin` + Task 2 `minRole:"admin"`), data query with candidate/status/date filters (Task 1), filter UI (Task 3), table with badges + row link + empty state (Task 4), tests (Tasks 1–2), manual checks (Task 5). All spec sections covered.
- **Types consistent:** `LogFilters`, `StatusLogRow`, `parseLogFilters`, `listStatusLogs` names match across Tasks 1 and 4; `candidateOptions()` reused from existing `@/lib/candidates`.
- **No placeholders:** every code step contains full code.

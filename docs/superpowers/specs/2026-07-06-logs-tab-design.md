# Logs Tab — Submission Status Audit (Design)

**Date:** 2026-07-06
**Status:** Approved (pending spec review)
**Branch:** `jira_updtaes_deek`

## Goal

Add an admin-only **Submission Logs** tab that shows every submission status change across all
submissions in a user-readable, filterable list. This surfaces the activity-log data
already captured by `submission_status_history` (the "Status changes create activity log
entries" acceptance criterion of the Submission Pipeline epic).

## Scope

**In scope**
- One new navigation item ("Logs"), admin-only.
- One new route `/logs` rendering a filterable, chronological table of submission status changes.
- Server-side filtering by candidate, status, and date range.
- Read-only. No creation, editing, or deletion of log entries.

**Out of scope (explicitly)**
- Audit logging for other entities (candidates, requirements, vendors, interviews,
  placements, tasks). No such logging exists today; adding it is a separate, much larger project.
- Export (CSV/PDF), pagination beyond a sensible row cap, or real-time updates.

## Hard Dependency

The tab reads `public.submission_status_history`, which exists **only after migration
`0007_submission_status_pipeline.sql` is applied** to the database. As of this design the
migration is NOT applied to the live DB (`dqdbrnpdoqtithcuoytw`). The Logs tab will error
until `0007` is run. Applying `0007` is a prerequisite, tracked separately.

## Design

### 1. Navigation
Add to `NAV_ITEMS` in `src/lib/roles.ts`:
```ts
{ label: "Submission Logs", href: "/logs", minRole: "admin" }
```
Placed alongside the other admin-only item ("Users"). Map the icon in
`src/components/app-shell/sidebar.tsx` `ICON_MAP`: `"/logs": ScrollText` (lucide-react).
Because `minRole` is `"admin"`, `canAccess` hides the tab from coordinators — no extra
sidebar guarding needed.

### 2. Route — `src/app/(app)/logs/page.tsx` (server component)
- Call `requireProfile()`.
- Defense-in-depth: if `profile.role !== "admin"`, `redirect("/dashboard")` so a coordinator
  cannot reach the page by typing the URL directly.
- Read filters from `searchParams`: `candidate` (uuid), `status` (SubmissionStatus), `from`
  (date), `to` (date). All optional.
- Fetch candidate options via `candidateOptions()` for the filter dropdown.
- Fetch rows via new `listStatusLogs(filters)`.
- Render the filter bar (client component) and the results table.

### 3. Data layer — `listStatusLogs(filters)` in `src/lib/submissions.ts`
Query `submission_status_history` with an **inner** embed to `submissions` and its
`candidates(full_name)` so every row carries a candidate name:

```
submission_status_history
  select: id, from_status, to_status, changed_by_name, changed_at,
          submissions!inner ( id, candidate_id, candidates ( full_name ) )
  filters (all optional, applied at DB level):
    - status  -> eq(to_status, status)
    - from    -> gte(changed_at, from)
    - to      -> lte(changed_at, to + 1 day  OR  <= end-of-day)
    - candidate -> eq(submissions.candidate_id, candidate)   // via inner embed
  order: changed_at desc
  limit: 500  (sane cap; logged if exceeded is out of scope — cap is fixed)
```

Returns a typed `StatusLogRow[]`:
```ts
interface StatusLogRow {
  id: string;
  submission_id: string;
  candidate_name: string | null;
  from_status: SubmissionStatus | null;
  to_status: SubmissionStatus;
  changed_by_name: string | null;
  changed_at: string;
}
```

### 4. Filter UI — client component (`logs-filters.tsx`)
- Candidate `<select>` (from `candidateOptions()`, plus "All candidates").
- Status `<select>` (`SUBMISSION_STATUSES`, plus "All statuses").
- From / To `<input type="date">`.
- On change, update the URL query string (via `useRouter().push` / `replace` with
  `URLSearchParams`), which re-runs the server component with new filters. Matches the app's
  existing server-component + searchParams pattern.
- A "Clear filters" action that navigates to `/logs`.

### 5. Results table
Columns:
| Candidate | Change | By | When |
|---|---|---|---|
| candidate_name (link to `/submissions/{submission_id}`) | `from_status` badge → `to_status` badge (or "created" when from is null) | `changed_by_name` | `formatDateTime(changed_at)` |

- Reuse `submissionStatusLabel` and `submissionStatusBadgeClass` from `job-constants`.
- Reuse `formatDateTime` from `lib/format`.
- Empty state: "No status changes match these filters."

## Error Handling
- Non-admin reaching `/logs` → redirected to `/dashboard`.
- If `submission_status_history` does not exist (migration not applied), the Supabase query
  returns an error; the page shows an empty state rather than crashing (guard on `data`/`error`).
- Invalid/garbage filter values are ignored (treated as "no filter").

## Testing
**Unit**
- `listStatusLogs` builds the correct query and maps rows to `StatusLogRow`
  (mock Supabase client): no filters, status filter, date range, candidate filter, combined.

**Manual**
- Admin: "Logs" tab visible; page lists status changes newest-first.
- Each filter (candidate, status, from, to) narrows results correctly; "Clear" resets.
- Row link navigates to the correct submission detail page.
- Coordinator: no "Logs" tab; visiting `/logs` directly redirects to `/dashboard`.
- Empty state renders when filters match nothing.

## Files Touched
- `src/lib/roles.ts` — add nav item.
- `src/components/app-shell/sidebar.tsx` — add icon mapping.
- `src/app/(app)/logs/page.tsx` — new route (server).
- `src/app/(app)/logs/logs-filters.tsx` — new filter client component.
- `src/lib/submissions.ts` — add `listStatusLogs` + `StatusLogRow`.
- Test file for `listStatusLogs`.

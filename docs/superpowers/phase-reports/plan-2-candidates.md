# Plan 2 — Candidate Module + Pipeline: Report

**Date:** 2026-06-26
**Branch:** `feat/phase1-foundation`
**Status:** Built & compiles; awaiting user DB migration + live verification.

## What was built
- **DB:** `candidates` table with `candidate_status` (7) and `pipeline_stage` (15)
  enums, an `updated_at` trigger, indexes, and RLS — coordinators see only their
  own (`assigned_coordinator_id = auth.uid()`), admins see all.
- **Data layer** (`src/lib/candidates.ts`): `listCandidates`, `getCandidate`,
  `listCoordinators` (RLS-scoped). **Constants** (`candidate-constants.ts`,
  tested): statuses, stages, visa options, label + badge helpers.
- **Server actions** (`candidates/actions.ts`): create, update, delete, `setStage`
  (board), `reassignCandidate` (admin-only).
- **Pages:** Candidates list (searchable table, status badges, clickable rows),
  create/edit form (Personal / Bench-sales / Professional / Status & pipeline),
  detail (tabs: Profile / Professional / Status / Timeline) with admin
  reassignment + delete, and the **Jira-style drag-and-drop Pipeline board**
  (@dnd-kit) that persists stage changes optimistically.
- **Seed:** `npm run seed:candidates` loads 6 sample consultants from the bench list.
- **Perf:** `getCurrentProfile` wrapped in React `cache()` to collapse repeated
  per-request auth/profile fetches.

## Verification (run after the migration)
1. Run `supabase/migrations/0002_candidates.sql` in Supabase SQL Editor.
2. `npm run seed:candidates`.
3. `npm run build` (green), `npm run test` (12 tests).
4. In-app: Candidates list shows 6; open one (tabs render); create a new one;
   edit it; drag a card across Pipeline columns and confirm it persists on
   refresh; as admin, reassign a candidate.

## Deferred
- Documents upload, activity-log feed, candidate↔requirement linking
  (Plans 3–4). Reassignment column-lock is enforced in the action, not RLS.

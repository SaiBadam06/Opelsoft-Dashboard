# OpelSoft Dashboard — Phase 1 Complete

**Date:** 2026-06-26
**Branch:** `feat/phase1-foundation`

## Modules built & wired (all with sample data)
- **Foundation:** auth (email-invite + setup-link), roles (admin/coordinator),
  RLS, app shell, theme (Space Grotesk + brand palette), branded loader, Users.
- **Candidates:** profile (bench-sales fields), list, create/edit, detail tabs,
  inline status dropdown, Jira pipeline board (drag-drop), admin reassign.
- **Vendors / Requirements / Submissions** (Plan 3): tables, forms, detail,
  inline status dropdowns, priority/status badges, admin delete.
- **Interviews / Placements / Tasks** (Plan 4): tables, forms, inline status
  dropdowns, admin delete.
- **Dashboard:** 10 live metric cards, Recent Activity feed (derived), Candidate
  Pipeline distribution bar.

## Database
Migrations 0001–0004 applied. Tables: profiles, candidates, vendors,
requirements, submissions, interviews, placements, tasks. RLS: candidates are
coordinator-scoped (admins see all); vendors/requirements/submissions/
interviews/placements/tasks are shared (authenticated read/write, admin delete).

Seed: `npm run seed:all` populates every table with representative dummy data.

## Verified
tsc clean · vitest (12 tests) · `next build` green · all routes present · seed
loaded (candidates 6, vendors 4, requirements 4, submissions 3, interviews 2,
placements 1, tasks 3).

## Deferred (future phases)
- **Excel/CSV importer** for bulk-loading the existing bench/placements sheets.
- **AI candidate↔requirement matching** and **JD parsing** (stub/interface only).
- **Document uploads** (resumes/certs to Supabase Storage) + per-candidate
  document tab.
- **Charts** beyond the pipeline bar (Recruiter Performance, Placements/Month,
  Top Vendors) — currently metrics + pipeline only.
- Custom SMTP for real invite emails (currently copyable setup links).

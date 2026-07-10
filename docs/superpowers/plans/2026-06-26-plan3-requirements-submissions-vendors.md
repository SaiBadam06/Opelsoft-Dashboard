# Plan 3 — Requirements + Submissions + Vendors

**Goal:** Add the job side of the system: Vendors (job providers), Requirements (open roles), and Submissions (candidate → requirement). Shared across the team (any authenticated user reads/writes; admin deletes).

**Stack:** Next.js 16, Supabase + RLS, shadcn/ui.

## Entities (migration 0003)
- **vendors**: name, contact_name, email, phone, notes.
- **requirements**: title, vendor_id→vendors, end_client (text), experience, skills, location, remote (bool), rate, employment_type, priority (enum), status (enum), closing_date, notes.
- **submissions**: candidate_id→candidates, requirement_id→requirements, vendor_id→vendors, end_client, prime_layer (enum), rate, submitted_date, resume_version, status (enum), notes.
- Enums: requirement_priority(low/medium/high/urgent), requirement_status(open/on_hold/filled/closed), submission_status(submitted/viewed/interview_scheduled/rejected/offer), prime_layer(prime/layer).
- RLS: `to authenticated` read+write all; delete admin only. updated_at triggers.

## Tasks
1. **Migration 0003** [USER runs].
2. **Data layer**: `lib/vendors.ts`, `lib/requirements.ts`, `lib/submissions.ts` (list/get + option lists) + `lib/job-constants.ts` (enum labels/badges, tested).
3. **Actions**: per entity create/update/delete (+ status setters where useful).
4. **Vendors**: list page + table + create/edit form (dialog or page).
5. **Requirements**: list (table, status/priority badges) + create/edit form + detail.
6. **Submissions**: list (table) + create form (pick candidate + requirement/vendor).
7. Build + verify + report.

UI: shadcn, semantic tokens, Space Grotesk, branded loader inherited. Inline status dropdowns where natural (requirement status, submission status) reusing the candidates pattern.

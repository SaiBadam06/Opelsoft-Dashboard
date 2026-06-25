# OpelSoft Staffing Dashboard — Design Spec

**Date:** 2026-06-25
**Status:** Approved (pending user review of this document)

## 1. Purpose

A minimalistic, hassle-free internal web app for OpelSoft (a US IT staffing /
bench-sales operation) to manage candidates (consultants) and recruiters through
the full placement pipeline. Users see each candidate's stage in the process,
full candidate details, full recruiter/placement-coordinator details, and the
operational lists the team already maintains in spreadsheets (bench, submissions,
interviews, placements, H1B-transfer list).

This replaces a set of Excel/Google Sheets with a single source of truth.

## 2. Domain context

OpelSoft runs **US IT staffing / bench sales (C2C consultant model)**. Evidence
from real operational data: Rate in $/hr, Visa types (H1B/OPT/USC/H4 EAD),
Vendor → Client chains, Prime/Layer positioning, Placement Coordinators, and
petitioner tracking. The data model below reflects this reality rather than a
generic full-time-recruiting template.

**Assumptions (to be confirmed):**
- **H1T** = H1B Transfer list (consultants whose H1B petition is being
  sponsored/transferred). Modeled as a flag/sub-status on Consultant.
- **Prime / Layer** = OpelSoft's position in the vendor chain (Prime = direct
  with the client's vendor; Layer = behind another sub-vendor).

## 3. Decisions (locked)

| Decision | Choice |
|---|---|
| Build sequencing | MVP core first, then layer the rest (3 phases) |
| Stack | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Supabase, deploy on Vercel |
| Candidate data model | US bench-sales model (Rate, Visa/Work Auth, Relocation, Petitioner, Vendor, Client, Prime/Layer) |
| Existing data | Build an Excel/CSV importer for bench, submissions, placements |
| Permissions | Coordinators see only their own consultants; Admin sees/manages everything |
| UI | Fresh modern admin UI (Linear/Vercel aesthetic), light + dark mode |
| Auth | Email invite + roles (Admin / Placement Coordinator); seeded dummy admin for testing |
| Supabase ownership | User creates the empty project + shares keys; Claude writes all schema/RLS/storage/seed/wiring |

## 4. Architecture

- **Frontend:** Next.js App Router, TypeScript, Tailwind, shadcn/ui components.
  Charts via Recharts, data tables via TanStack Table, Excel parsing via SheetJS.
- **Backend:** Supabase — Postgres for data, Auth for users/roles, Storage for
  resumes and documents.
- **Security:** Row-Level Security (RLS) enforces the ownership rule at the
  database layer, not just the UI. Every record stamps `created_by` /
  `updated_by` and timestamps.
- **Deploy:** Vercel; env vars hold Supabase URL, anon key, and service-role key
  (service-role used only in server-side admin actions like inviting users and
  the seed script).

## 5. Data model — core entities

Everything the team currently tracks as a separate "list" becomes a **filtered
view** over a small set of core tables. No double-entry.

### Core tables
- **profiles** — app users mirrored from Supabase Auth; `role`
  (admin | coordinator), name, contact. A coordinator's profile is what
  consultants are "assigned to."
- **consultants** (candidates — the heart of the system)
  - Personal: name, email, phone, location, total experience, current company,
    LinkedIn, GitHub, portfolio
  - Bench-sales: **rate ($/hr), visa / work authorization, relocation
    (yes/remote/city), petitioner**, availability
  - Professional: primary skills, secondary skills, certifications, projects,
    education, preferred location
  - Status (overall): Available, Interviewing, Submitted, Offered, Placed,
    Rejected, Inactive
  - **pipeline_stage** (Jira-style): New, Contacted, Interested, Resume Received,
    Screening, Matched, Submitted, Interview R1, Interview R2, Final Interview,
    Offer Released, Offer Accepted, Placed, Rejected, Hold
  - **h1b_transfer** flag (drives the H1T list)
  - `assigned_coordinator_id` → profiles
- **requirements** — Title, Client, Vendor, experience, skills, location, remote,
  budget/rate, notice period, employment type, priority, status, created date,
  closing date. (AI JD-parse is a Phase-3 enhancement.)
- **submissions** — consultant × requirement, vendor, client, **prime_layer**,
  rate, submitted date, resume version, status (Submitted, Viewed, Interview
  Scheduled, Rejected, Offer), assigned coordinator
- **interviews** — consultant, company/client, round, date, mode, interviewer,
  feedback, result
- **placements** — consultant, recruiter, OPT recruiter, vendor, client,
  new/exp, rate, placement date, project start date, BGV + date, In/Out,
  project end date, feedback
- **vendors** — name, contact name, email, phone (first-class, reusable)
- **clients** — name, notes (first-class; powers "Top Clients")
- **tasks** — type (Call Candidate, Follow-up, Schedule Interview, Collect
  Documents, Send Resume, Offer Discussion), consultant, assigned coordinator,
  due date, status. Feeds "Pending Follow-ups."
- **documents** — consultant, type (Resume, Cover Letter, Certificate, ID Proof),
  Storage path, version
- **activity_log** — auto-written on key events; powers "Recent Activity."

### Derived views (no new tables)
- **Bench list** = consultants where status = Available
- **H1T list** = consultants where `h1b_transfer = true`
- **Submissions / Interviews / Placements lists** = their tables, filtered/sorted

## 6. Permissions (RLS)

- **Coordinator:** read/write only consultants where
  `assigned_coordinator_id = auth.uid()`, plus the submissions, interviews,
  tasks, and documents belonging to those consultants. Private tasks/notes stay
  with the owner.
- **Admin:** full read/write across all tables; manages users (invite, assign
  role, deactivate), deletes records, edits settings.
- **Admin reassignment:** the Admin can assign or re-assign any consultant to
  any Placement Coordinator at any time (changing `assigned_coordinator_id`),
  which immediately moves that consultant into the new coordinator's scope. This
  is exposed in the consultant detail view and as a bulk action on the
  consultant list.
- Vendors and Clients are shared/readable by all authenticated users (writes
  may be admin-restricted — to confirm during implementation).

## 7. Modules & UI

**Navigation (left sidebar):** Dashboard, Consultants, Pipeline, Requirements,
Submissions, Interviews, Placements, Vendors & Clients, Tasks. Top bar with
global search and user menu.

**Dashboard** — cards: Total Candidates, Active Candidates, Active Requirements,
Recruiters, Interviews Today, Placements, Pending Follow-ups, Submissions Today,
Offers Released, Rejected. Charts (Phase 2): Candidate Pipeline, Recruiter
Performance, Placements per Month, Interview Conversion, Requirements Filled,
Top Clients. Recent Activity feed from `activity_log`.

**Consultant module** — list with filters/saved views; detail with Personal /
Professional / Status / Documents / Timeline tabs. **Pipeline** is a
drag-and-drop Jira-style board over `pipeline_stage`.

**UI principles:** dense fast tables, slide-over detail panels, card-based
dashboard, light + dark mode, Linear/Vercel-style neutral professional palette.

## 8. Phasing

- **Phase 1 (MVP):** Auth + seeded admin · Consultant module (profile,
  bench-sales fields, documents, status, timeline) · Jira pipeline board ·
  Requirements · Submissions · Vendors/Clients · Dashboard cards + Recent
  Activity · Excel importer (bench, submissions, placements).
- **Phase 2:** Interviews · Placements · Tasks/reminders · all charts.
- **Phase 3:** One-click candidate matching/scoring · AI JD parsing. Stubbed now
  behind a clear interface, real implementation later.

## 9. Supabase setup deliverables

- SQL migrations for all tables (types, constraints, FKs, indexes)
- RLS policies implementing Section 6
- Storage buckets for resumes/documents with access rules
- Seed script: dummy admin account + representative sample data (from the
  provided bench/submissions/placements samples)
- Step-by-step setup guide + exact `.env` values (Supabase URL, anon key,
  service-role key) for local dev and Vercel
- User creates the empty Supabase project and shares URL + keys; Claude does
  everything else.
- **The user is new to Supabase**, so every Supabase action is delivered as
  click-by-click instructions: exactly which dashboard page/button to click,
  what value to copy, and where to paste it. No step assumes prior Supabase
  knowledge.

## 10. Per-phase completion protocol

At the end of **every phase**, before moving on:
1. Announce clearly: "I have completed Phase N" (with the phase number/name).
2. Write a detailed phase report to
   `docs/superpowers/phase-reports/phase-N-<name>.md` covering: what was built,
   the tables/files/components added or changed, any Supabase steps the user must
   run (click-by-click), how to test it, and what's deferred to later phases.
3. Commit the phase work and its report.

## 11. Out of scope (for now)

- Public candidate-facing job application portal (separate from this internal
  tool)
- Real AI matching/JD parsing (interface stubbed in Phase 1, built in Phase 3)
- Billing/invoicing, email campaigns, calendar sync (revisit later if needed)

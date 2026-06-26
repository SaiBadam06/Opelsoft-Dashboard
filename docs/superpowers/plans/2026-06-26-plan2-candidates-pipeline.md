# OpelSoft Dashboard — Plan 2: Candidate Module + Pipeline Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the heart of the system — Candidates (US bench-sales talent) with full profiles, list + detail views, create/edit, and a Jira-style drag-and-drop pipeline board, all enforced by "coordinators see only their own candidates; admin sees all and can reassign."

**Architecture:** A `candidates` table in Supabase with enums for status and pipeline stage, protected by RLS keyed on `assigned_coordinator_id`. A thin server data layer (`src/lib/candidates.ts`) wraps queries; server actions handle create/update/reassign/stage-change. Pages: list (filterable table), detail (tabbed profile), and a pipeline board (drag-and-drop via @dnd-kit) that updates `pipeline_stage` on drop.

**Tech Stack:** Next.js 16, Supabase (Postgres + RLS), shadcn/ui, @dnd-kit for the board, Space Grotesk UI.

**Terminology:** "Candidate" = the talent being placed. "Consultant" = OpelSoft itself (never used for the talent). Vendors provide jobs. No Client entity.

---

## File Structure

```
supabase/migrations/0002_candidates.sql   # candidates table, enums, RLS, triggers
src/lib/candidates.ts                      # types + data access (list/get/create/update/reassign/setStage)
src/app/(app)/candidates/
  page.tsx                                 # list (filterable table)
  candidates-table.tsx                     # client table + filters
  new/page.tsx                             # create form page
  [id]/page.tsx                            # detail (tabs)
  [id]/edit/page.tsx                       # edit form page
  candidate-form.tsx                       # shared create/edit client form
  reassign-control.tsx                     # admin-only coordinator reassignment
  actions.ts                               # server actions (create/update/delete/reassign/setStage)
src/app/(app)/pipeline/
  page.tsx                                 # board data load
  pipeline-board.tsx                       # client drag-and-drop board
src/lib/candidate-constants.ts             # status + stage labels/orders (shared, testable)
src/lib/candidate-constants.test.ts
```

---

## Task 1: Database migration — candidates

**Files:** Create `supabase/migrations/0002_candidates.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Enums
create type public.candidate_status as enum (
  'available','interviewing','submitted','offered','placed','rejected','inactive'
);
create type public.pipeline_stage as enum (
  'new','contacted','interested','resume_received','screening','matched',
  'submitted','interview_r1','interview_r2','final_interview',
  'offer_released','offer_accepted','placed','rejected','hold'
);

-- Generic updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  location text,
  experience_years numeric,
  current_company text,
  rate numeric,                       -- hourly $
  visa text,                          -- work authorization
  relocation text,
  petitioner text,
  availability text,
  linkedin text,
  github text,
  portfolio text,
  primary_skills text,
  secondary_skills text,
  certifications text,
  projects text,
  education text,
  preferred_location text,
  status public.candidate_status not null default 'available',
  pipeline_stage public.pipeline_stage not null default 'new',
  visa_transfer boolean not null default false,   -- H1T list
  notes text,
  assigned_coordinator_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index candidates_coordinator_idx on public.candidates(assigned_coordinator_id);
create index candidates_status_idx on public.candidates(status);
create index candidates_stage_idx on public.candidates(pipeline_stage);

create trigger candidates_set_updated_at
  before update on public.candidates
  for each row execute function public.set_updated_at();

-- RLS: coordinators see only their own; admins see all
alter table public.candidates enable row level security;

create policy "candidates_select" on public.candidates for select
  using (public.is_admin() or assigned_coordinator_id = auth.uid());

create policy "candidates_insert" on public.candidates for insert
  with check (public.is_admin() or assigned_coordinator_id = auth.uid());

create policy "candidates_update" on public.candidates for update
  using (public.is_admin() or assigned_coordinator_id = auth.uid());

create policy "candidates_delete" on public.candidates for delete
  using (public.is_admin() or assigned_coordinator_id = auth.uid());
```

- [ ] **Step 2: [USER ACTION] Run it** — Supabase → SQL Editor → New query → paste `0002_candidates.sql` → Run. Expect "Success. No rows returned." Confirm the `candidates` table appears in Table Editor.

- [ ] **Step 3: Commit** `git add supabase/migrations/0002_candidates.sql && git commit -m "feat(db): candidates table + enums + RLS"`

---

## Task 2: Shared constants (tested)

**Files:** Create `src/lib/candidate-constants.ts`, `src/lib/candidate-constants.test.ts`

- [ ] **Step 1: Failing test** — assert `PIPELINE_STAGES` has 15 entries in order, `STATUS_OPTIONS` has 7, and `stageLabel('interview_r1') === 'Interview R1'`.
- [ ] **Step 2: Implement** — export `PIPELINE_STAGES` (array of `{value,label}` in board order), `STATUS_OPTIONS`, `VISA_OPTIONS`, helper `stageLabel(v)`, `statusBadgeClass(status)` (maps status → semantic token class e.g. placed→bg-success). Keep pure (no React).
- [ ] **Step 3: Run tests** `npm run test` → pass.
- [ ] **Step 4: Commit**

---

## Task 3: Data layer

**Files:** Create `src/lib/candidates.ts`

- [ ] **Step 1:** Define `Candidate` type (all columns). Implement, using `@/lib/supabase/server`:
  - `listCandidates(filters?)` → select \* ordered by updated_at desc (RLS scopes automatically).
  - `getCandidate(id)` → single.
  - These run as the logged-in user (RLS enforces visibility).
- [ ] **Step 2:** Typecheck `npx tsc --noEmit`.
- [ ] **Step 3: Commit**

---

## Task 4: Server actions

**Files:** Create `src/app/(app)/candidates/actions.ts`

- [ ] **Step 1:** `createCandidate(formData)` — build payload, set `assigned_coordinator_id` to current user (admins may pick later), `created_by`/`updated_by`, insert, redirect to detail. `updateCandidate(id, formData)`. `deleteCandidate(id)`. `setStage(id, stage)` — update pipeline_stage (used by board). `reassignCandidate(id, coordinatorId)` — **admin only** (check `getCurrentProfile().role==='admin'`), updates `assigned_coordinator_id`. All revalidate the relevant paths.
- [ ] **Step 2:** Typecheck. **Commit.**

---

## Task 5: Candidate list page

**Files:** Create `src/app/(app)/candidates/page.tsx`, `candidates-table.tsx`

- [ ] **Step 1:** Server `page.tsx` loads `listCandidates()`, renders header ("Candidates" + "Add candidate" button → /candidates/new) and `<CandidatesTable candidates={...} />`.
- [ ] **Step 2:** Client `candidates-table.tsx`: a search box (filter by name/skills/visa) + a shadcn table with columns Name, Rate, Visa, Location, Status (Badge), Stage, Coordinator; each row links to `/candidates/[id]`. Use `Empty` state when none. Semantic tokens only.
- [ ] **Step 3:** Build + **Commit.**

---

## Task 6: Candidate create/edit form

**Files:** Create `candidate-form.tsx`, `new/page.tsx`, `[id]/edit/page.tsx`

- [ ] **Step 1:** `candidate-form.tsx` (client) — a sectioned form (Personal, Bench-sales [rate/visa/relocation/petitioner/availability], Professional [skills/certs/projects/education], Status [status + pipeline_stage + visa_transfer]) using shadcn Input/Label/Select/Textarea/Switch. Accepts optional `candidate` for edit. Submits to `createCandidate`/`updateCandidate` via `useActionState`; toast + spinner.
- [ ] **Step 2:** `new/page.tsx` renders form (create). `[id]/edit/page.tsx` loads candidate, renders form (edit).
- [ ] **Step 3:** Build + **Commit.**

---

## Task 7: Candidate detail

**Files:** Create `src/app/(app)/candidates/[id]/page.tsx`, `reassign-control.tsx`

- [ ] **Step 1:** Detail page: header (name, status badge, stage, rate, visa) + Edit/Delete buttons. Tabs (shadcn Tabs): Profile (personal+contact), Professional (skills/certs/projects/education), Status (status/stage/visa_transfer), Timeline (created/updated, placeholder for events). Admin-only `<ReassignControl>` to change coordinator (Select of coordinators → `reassignCandidate`).
- [ ] **Step 2:** `reassign-control.tsx` (client) — loads coordinators (passed as prop from server), Select + save → `reassignCandidate`, toast, refresh. Only rendered for admins.
- [ ] **Step 3:** Build + **Commit.**

---

## Task 8: Pipeline board (drag-and-drop)

**Files:** Add `@dnd-kit/core`; create `src/app/(app)/pipeline/page.tsx`, `pipeline-board.tsx`

- [ ] **Step 1:** `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`.
- [ ] **Step 2:** `page.tsx` loads `listCandidates()`, groups by stage, passes to `<PipelineBoard>`.
- [ ] **Step 3:** `pipeline-board.tsx` (client): horizontal scroll of stage columns (from `PIPELINE_STAGES`), each a droppable holding candidate cards (draggable). On drop into a new column, optimistically move the card and call `setStage(id, stage)`; toast on error + revert. Cards show name, rate, visa, coordinator. Semantic tokens.
- [ ] **Step 4:** Build + **Commit.**

---

## Task 9: Seed sample candidates (optional, from bench list)

**Files:** Add to `scripts/seed.ts` (or `scripts/seed-candidates.ts`)

- [ ] **Step 1:** Insert ~6 sample candidates from the provided bench list (RaviKrishna/DE/OH/H1B/$60, Vijetha/DE/TX/H1B/$70, Shivani/BA/NJ/H1B/$60, Rohith/Java/CA/H1B/$70, Mahith/Salesforce/NJ/H1B/$60, SaiLaxmi/BA-Scrum/OR/USC/$65), assigned to the admin, varied statuses/stages. Run `npm run seed`.
- [ ] **Step 2: Commit.**

---

## Task 10: Verify + report

- [ ] **Step 1:** `npm run test`, `npx tsc --noEmit`, `npm run build` all green.
- [ ] **Step 2:** Live smoke: list shows seeded candidates; create works; detail tabs render; board drag changes stage (verify persisted).
- [ ] **Step 3:** Write `docs/superpowers/phase-reports/plan-2-candidates.md` and **commit.**

## Self-Review Notes
- Spec coverage: candidate profile fields (bench-sales) ✓, status ✓, pipeline stages (15) ✓, visa_transfer/H1T ✓, RLS own-only + admin-all + reassign ✓, list/detail/create/edit ✓, Jira board ✓. Documents tab + activity feed deferred to later plans.
- RLS reassignment caveat: column-level lock not enforced in SQL; `reassignCandidate` is admin-gated in the action. Acceptable; revisit with a column policy if needed.

# AI Resume Autofill, Document Bar & Global Skill Search — Design

**Date:** 2026-07-08
**Status:** Approved (brainstorm) — ready for planning

## Summary

Three related capabilities for the candidates module:

1. **Document-type bar** — replace the folder/type `<select>` dropdown with a segmented button bar.
2. **AI resume autofill** — on candidate creation, upload a resume and auto-fill the candidate form by parsing it (ported from the `JD-Resume-parsing` repo: Gemini + text extraction + GitHub enrichment). Store the full parse in Supabase for later analysis.
3. **Global job-based skill search** — enter a job title; an AI agent infers the required skills, confirms with the user (who may add/remove skills), then ranks candidates across the whole database by their stored skills.

Parsing approach is ported verbatim from `JD-Resume-parsing`. **The repo's validation/scoring logic is intentionally not ported.**

## Reference: how the source repo parses

Three-stage pipeline (`JD-Resume-parsing/app/api/screen-resume/route.ts`):

1. **Text extraction** (`extract-text.ts`) — branches on extension: `.pdf` → `pdf-parse` (throws if <50 chars), `.docx` → `mammoth.extractRawText`, else raw UTF-8. Plain string out. No OCR.
2. **Structured parse** (`gemini.ts` `parseResume`) — sends text to Gemini 2.5 Flash, prompt demands JSON only, strips markdown fences, `JSON.parse`. Extracts `candidate_name, email, skills[], experiences[], projects[], education[], github_urls[]`.
3. **GitHub enrichment** (`github.ts` `fetchGithubRepos`) — regex-scrapes `github.com/owner/repo` and `/user` links, hits the live GitHub API (7-day cache), unreachable repos marked `verified:false`, capped at 6 repos.

We port stages 1–3. We skip the repo's `scoreResume` (validation).

## Existing dashboard facts that shape the build

- **Stack:** Next.js App Router, server actions (no API routes), Supabase, shadcn/ui.
- **Candidate fields** (`0002_candidates.sql`, `src/lib/candidates.ts`): skills are plain text columns `primary_skills`, `secondary_skills`; also `github`, `projects`, `education`, `email`, `full_name`, etc.
- **Documents** (`documents-tab.tsx`, `document-actions.ts`, `0005_documents.sql`): client uploads to the `candidate-docs` bucket, then the `recordDocument` server action inserts a `documents` row. **Requires an existing `candidateId`** — the storage path is `${candidateId}/...`.
- **Doc types** (`src/lib/documents.ts` `DOCUMENT_TYPES`): resume, cover_letter, certificate, work_auth, driving_licence, other. Currently chosen via a `<select>`.
- **New candidate page** (`new/page.tsx`) renders `CandidateForm` with no `candidate` prop and no id.
- **Create flow** (`actions.ts` `createCandidate`): uses `useActionState`, inserts the row, then `redirect`s to the detail page.

## A. Document-type bar

Replace the `<select>` in `documents-tab.tsx` with a segmented bar: a row of pill `Button`s generated from `DOCUMENT_TYPES`, active type highlighted (`variant="default"` vs `variant="outline"`). Behavior identical — sets the same `type` state. Reused on the New Candidate autofill panel. No new dependency.

## B. Parsing library (`src/lib/parsing/`)

Ported from the repo, Gemini-based:

- **`extract-text.ts`** — verbatim: pdf-parse / mammoth / utf-8, same <50-char guard error message.
- **`gemini.ts`** — `parseResume(text): Promise<ParsedResume>` with the repo's exact prompt and JSON shape. Model `gemini-2.5-flash`. Fence-strip + `JSON.parse`.
- **`github.ts`** — `fetchGithubRepos(text, extraUrls)` verbatim, incl. the link regex, non-user filter, 6-repo cap, and 7-day cache. Cache uses a small `github_cache` table (ported migration).
- **`types.ts`** — `ParsedResume`, `GitHubRepo` interfaces (subset of the repo's types; no scoring types).

New dependencies: `@google/generative-ai`, `pdf-parse`, `mammoth`.
New env vars: `GEMINI_API_KEY` (required), `GITHUB_TOKEN` (optional, raises GitHub rate limit).

## C. Autofill on candidate creation

Flow: **parse in memory first, persist only on Save.** Nothing is stored if the user abandons the form.

**UI** — an "Autofill from resume" panel at the top of `CandidateForm`, rendered only in create mode (no `candidate` prop):
- Document-type bar (defaults to Resume) + file input + **Autofill** button.
- On Autofill: call `parseResumeAction(file)` server action → returns `{ fields, parsed, githubRepos }`. `fields` maps the parse onto form inputs:
  - `full_name` ← `candidate_name`
  - `email` ← `email`
  - `primary_skills` ← `skills` joined (comma-separated)
  - `education` ← `education` joined
  - `projects` ← `projects` summarized to text
  - `github` ← first `github_urls` entry
- The form pre-fills those fields (editable). The user reviews and edits.
- The selected `File`, the full `parsed` object, and `githubRepos` are held in client state.

**Field prefill mechanism:** `CandidateForm` currently uses uncontrolled `defaultValue` inputs. To inject parsed values, hold a `prefill` state object seeded empty; when autofill returns, set `prefill` and force the field group to re-mount via a React `key` bound to a prefill version counter, so `defaultValue`s pick up the parsed data. User edits after that are normal uncontrolled edits captured on submit. (Only the autofillable fields need this; the rest stay as-is.)

**Save (create mode with a resume attached):** a client submit handler runs:
1. `createCandidateAction(formData)` — inserts the candidate, **returns `{ id }`** (create path no longer server-redirects when called this way; see below).
2. Client uploads the held `File` to `candidate-docs` at `${id}/${Date.now()}-${safeName}` (existing upload pattern).
3. `recordDocument({ candidateId: id, type: 'resume', ... })`.
4. `saveResumeParseAction(id, parsed, githubRepos)` — inserts the `candidate_parsings` row.
5. `router.push(/candidates/${id})`.

If no resume is attached, the form submits exactly as today (plain create → redirect).

**Action change:** `createCandidate` is refactored so the create-with-resume path can obtain the new id client-side. Options during planning: a new `createCandidateReturningId` action, or a flag. `updateCandidate` is unchanged. Plain create (no resume) keeps today's redirect behavior.

## D. Storage: `candidate_parsings` table

Migration `0011_candidate_parsings.sql`:

```sql
create table public.candidate_parsings (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  skills text[] not null default '{}',   -- normalized, lowercase; drives search
  parsed jsonb not null,                  -- full ParsedResume
  github_repos jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index candidate_parsings_candidate_idx on public.candidate_parsings(candidate_id);

alter table public.candidate_parsings enable row level security;
-- Scoped through candidate ownership (mirrors candidates RLS: admin all, coordinator own)
```

RLS policies check that the linked candidate is visible to the current user (subquery/join on `candidates`, reusing `public.is_admin()` + `assigned_coordinator_id = auth.uid()`).

`skills[]` is stored normalized (trimmed, lowercased) so overlap search is simple. `parsed` + `github_repos` retained for future analysis.

Also port the repo's `github_cache` table as `0012_github_cache.sql` (key text pk, data jsonb, fetched_at timestamptz) so `fetchGithubRepos` caching works.

## E. Global job-based skill search — `/search`

New route `src/app/(app)/search/page.tsx` + client component, plus server actions.

**Step 1 — infer skills.** Input: job title. **Find skills** button → `inferSkillsAction(title)` — one Gemini call, prompt: "For the job title '<title>', list the concrete skills/technologies it typically requires." Returns `{ required: string[], niceToHave: string[] }`.

**Step 2 — confirm.** Skills shown as editable chips grouped required / nice-to-have. Copy: "This job title requires these skills. Add or remove any, then search." User can add/remove chips. **Search candidates** button.

**Step 3 — rank (hybrid: overlap → shortlist → AI re-rank).** `searchCandidatesAction(skills)`:
1. Fetch all `candidate_parsings` (RLS-scoped) joined to candidate name/id, reading `skills[]`.
2. **Overlap score** in JS: case-insensitive match of confirmed skills against each candidate's stored skills, with a small synonym map (e.g. `js`↔`javascript`, `ts`↔`typescript`, `py`↔`python`, `k8s`↔`kubernetes`). Score = matched / total confirmed.
3. **Shortlist** the top ~20 by overlap.
4. **AI re-rank:** one Gemini call passing the confirmed skills + the shortlist's skills; returns an ordered ranking with a one-line reason per candidate.
5. Return `{ candidateId, name, overlapPct, matched[], missing[], aiReason }[]`, ordered by the AI ranking.

**Results UI:** a table/list — candidate name (links to `/candidates/[id]`), overlap %, matched skills (green) / missing skills (muted), AI reason. Empty-state when no candidates have parsed skills yet.

Add a **Search** entry to the sidebar (`src/components/app-shell/sidebar.tsx`).

## Phasing

1. **Phase 1** — document bar + parsing library (`src/lib/parsing/`, deps, env, `github_cache` migration). Self-contained; unit-test extraction + link regex.
2. **Phase 2** — autofill on create + `candidate_parsings` storage (migration, `parseResumeAction`, `saveResumeParseAction`, form panel, create-path refactor).
3. **Phase 3** — global skill search (`/search`, `inferSkillsAction`, `searchCandidatesAction`, overlap+synonyms, AI re-rank, sidebar link).
4. **Phase 4** — polish (loading/error states, empty states, edge cases: scanned PDF error surfaced to user, missing `GEMINI_API_KEY` guard, no-skills candidates).

Per-phase completion reports. **No commit or push until the user explicitly asks.**

## Out of scope (YAGNI)

- Re-parsing on candidate edit (autofill is create-only).
- Parsing non-resume docs (license, work auth) — stored as files only for now.
- OCR for scanned/image PDFs — surfaced as an error, not handled.
- GIN index on `skills[]` — overlap runs in JS until candidate volume demands it.
- Porting the repo's resume scoring / job-spec matching (`scoreResume`, `parseJD`).

## Error handling

- Text extraction failure (scanned PDF, <50 chars) → the parse action returns the repo's error message; the autofill panel shows it, form stays usable for manual entry.
- Missing `GEMINI_API_KEY` → actions return a clear config error rather than throwing.
- GitHub enrichment is fail-soft (already: unreachable repos → `verified:false`); never blocks autofill or save.
- Gemini returning non-JSON → catch `JSON.parse`, return a friendly "couldn't read this resume, enter details manually" error.

## Testing

- Unit: `extract-text` (txt path), GitHub link regex extraction, skill-overlap scorer + synonym map. No live Gemini/GitHub calls in tests.
- Manual (per work-style): click-through of autofill on New Candidate and a global search, with Supabase steps called out step by step.

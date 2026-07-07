# Candidate Document Upload + AI Autofill — Design

**Date:** 2026-07-07
**Status:** Approved (design), ready for implementation plan
**Feature:** A of two (B = global job-title skill search, separate spec later)

## Goal

When creating a candidate, let users upload documents into per-type "folders"
via a segmented bar (not a dropdown), and offer an **Autofill from documents**
action that parses the uploaded files with Gemini and prefills the candidate
form for review before save. Only the resume's parsed JSON is persisted.

## Current state (what exists)

- `candidates` table: structured fields incl. `full_name`, `email`, `phone`,
  `location`, `experience_years`, `current_company`, `primary_skills`,
  `secondary_skills`, `certifications`, `education`, `projects`, `github`,
  `linkedin`, `portfolio`, `visa`. Created via server-action form
  (`src/app/(app)/candidates/candidate-form.tsx`, `.../new/page.tsx`,
  `.../actions.ts`).
- `documents` table + private `candidate-docs` storage bucket. Types:
  `resume`, `cover_letter`, `certificate`, `work_auth`, `driving_licence`,
  `other` (`src/lib/documents.ts`).
- Detail-page upload UI uses a `<select>` for type
  (`src/app/(app)/candidates/documents-tab.tsx`) — the dropdown to replace.
- **No AI/LLM integration exists yet.** All parsing is new.

## Decisions (locked)

- **Provider:** Google Gemini `gemini-2.5-flash`. Key in `.env.local` as
  `GEMINI_API_KEY` (gitignored; never committed).
- **Build order:** this feature first; job-title skill search is a later spec.
- **Autofill flow:** parse → prefill → review → save. Nothing writes to DB or
  storage until the user clicks Save.
- **Autofill scope:** parses *every* attached file, not just the resume.
- **Merge rule:** resume is the primary source for overlapping fields; other
  docs fill blanks and contribute their own fields; never overwrite a value the
  user already typed.
- **Persistence:** only the **resume's** parsed JSON is stored (in a new
  `documents.parsed_data` JSONB column on the resume's document row). Other docs
  are parsed in memory for autofill only, then discarded.
- **Doc extraction:** "everything readable" — the parse prompt for non-resume
  docs asks Gemini to return all readable fields as JSON (used to fill blanks).

## Components

### 1. Upload "bar" component
Horizontal segmented bar of document-type folders:
`Resume · Cover Letter · Certificate · Work Auth · Driving Licence · Other`
(sourced from `DOCUMENT_TYPES` in `src/lib/documents.ts`). Selecting a folder
shows a dropzone/file input for that type; attached files list beneath.

- Reused in **two** places: the detail-page documents tab (replacing the
  `<select>`) and the new-candidate create form.
- In the create form the bar holds files client-side (no upload yet) until Save.

### 2. Parsing lib — `src/lib/gemini.ts`
Mirrors the reference repo's shape, swapped to the Gemini SDK.
- `parseText(text: string): Promise<ParsedResume>` — for text docs (pdf/docx/txt).
  Prompt ported/adapted from the repo's `parseResume`.
- `parseImage(bytes, mimeType): Promise<Record<string, unknown>>` — Gemini
  vision, "extract everything readable" → JSON, for image/scanned docs.
- Both strip code fences and `JSON.parse` the response (mirrors repo).

### 3. Text extraction helper — `src/lib/extract-text.ts`
Ported from the repo: pdf → `pdf-parse`, docx → `mammoth`, else UTF-8. Throws on
apparently-scanned PDFs (too little text) so the caller can fall back to vision.

### 4. Parse API route(s) — `src/app/api/parse/...`
Accepts an uploaded file (no candidate id required), routes by file kind:
- text-extractable (pdf with text, docx, txt) → `extract-text` → `parseText`
- image or scanned pdf → `parseImage` (vision)

Returns `{ type, parsed }` JSON. No DB writes. Called once per attached file when
the user clicks Autofill.

### 5. Create form autofill wiring
- New **Autofill from documents** button in the create form.
- On click: POST each attached file to the parse route; collect results.
- Merge into form state (resume primary → others fill blanks → never overwrite
  user-typed values). Map parsed fields to form field names (name, email, phone,
  location, experience, skills → `primary_skills`, certifications, education,
  projects, github, linkedin, visa where present).
- Keep the resume's parsed JSON in form state for persistence on Save.

### 6. Save path
On Save (extend `createCandidate` action / new-page flow):
1. Create candidate row → get `id`.
2. Upload each attached file to `candidate-docs/{id}/...` (existing pattern).
3. Insert `documents` rows. On the **resume** row, set `parsed_data` = resume
   parsed JSON; other rows leave `parsed_data` null.

### 7. Migration `0011_document_parsed_data.sql`
`alter table public.documents add column parsed_data jsonb;`

## Data flow

```
Create form: attach files (bar, client-side)
   → click Autofill
      → POST each file → /api/parse → { type, parsed }
      → merge into form (resume primary, fill blanks, no overwrite)
   → user reviews/edits
   → Save
      → insert candidate → upload files → insert documents
         (resume row carries parsed_data JSON; others null)
```

## Error handling

- Parse failure on one file: toast the error, skip that file, continue autofill
  with the rest (fail-soft, mirrors repo's tolerant style). Never block Save.
- Scanned-PDF resume (no extractable text): fall back to `parseImage`.
- Malformed model JSON: caught at parse boundary, surfaced as a parse error for
  that file; user can still fill the form manually.
- Gemini/network error: autofill reports failure; manual entry unaffected.

## Testing

- `extract-text` unit test (ported from repo): pdf/docx/txt branches + the
  scanned-PDF threshold throw.
- `gemini.ts`: a small check that `parseText` maps a sample resume text to the
  expected `ParsedResume` shape (mock the SDK call).
- Merge helper: unit test that resume wins overlaps, others fill blanks, typed
  values are never overwritten.

## Out of scope (YAGNI / deferred)

- Storing non-resume parsed data (explicitly excluded).
- Separate extraction table (JSONB column covers persistence).
- Background/async parsing (parse on-demand at button click).
- Feature B (job-title skill search) — separate spec.

## Jira

**Story 1 — Candidate document upload + AI autofill (Gemini):** this spec.
**Story 2 — Global job-title skill search across candidate database:** later
spec; depends on Story 1 for reliable candidate skill data.

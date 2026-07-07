# Candidate Document Upload + AI Autofill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users attach documents by type (segmented "folder" bar) while creating a candidate, and click **Autofill from documents** to parse them with Gemini and prefill the form; persist only the resume's parsed JSON.

**Architecture:** Parsing runs in **server actions** (Gemini key + node libs stay server-side), not an API route. The candidate create form holds files in per-type `<input type=file>` elements so they ride the existing `createCandidate` server action in FormData; that action uploads files server-side and records document rows (resume row carries `parsed_data`). A pure merge helper maps parsed output → form fields (resume primary, others fill blanks, never overwrite typed values).

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, Supabase (storage + Postgres), Gemini `gemini-2.5-flash` via `@google/generative-ai`, `pdf-parse`, `mammoth`, Vitest.

**Scope:** Feature A only. Feature B (global job-title skill search) is a separate spec/plan built later on this same branch.

---

### Task 1: Dependencies, config, migration, env

**Files:**
- Modify: `package.json` (deps)
- Modify: `next.config.ts:3-9`
- Create: `supabase/migrations/0011_document_parsed_data.sql`
- Modify: `.env.local` (add key — not committed)

- [ ] **Step 1: Install deps**

Run: `npm install @google/generative-ai pdf-parse mammoth`

- [ ] **Step 2: Raise the server-action body limit** (resumes/images exceed the 1MB default)

In `next.config.ts`, add inside `nextConfig`:

```ts
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
```

- [ ] **Step 3: Migration for parsed_data column**

Create `supabase/migrations/0011_document_parsed_data.sql`:

```sql
-- Store the AI-parsed resume JSON on its document row (resume rows only; other doc types stay null).
alter table public.documents add column if not exists parsed_data jsonb;
```

- [ ] **Step 4: Add the Gemini key locally**

Append to `.env.local` (gitignored — `.env*` is in `.gitignore`):

```
GEMINI_API_KEY=AIzaSyBPym2IR6i0Z6s4NKLZYcJuJu2YBswW4uI
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json next.config.ts supabase/migrations/0011_document_parsed_data.sql
git commit -m "chore: add gemini/pdf/mammoth deps, parsed_data migration, action body limit"
```

> **Supabase step (manual, run migration in dashboard):** paste `0011_document_parsed_data.sql` into the SQL editor and run it. (Detailed click-through provided at execution time per your workflow.)

---

### Task 2: Text extraction helper

**Files:**
- Create: `src/lib/extract-text.ts`
- Test: `src/lib/extract-text.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/extract-text.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { extractText } from "@/lib/extract-text";

describe("extractText", () => {
  it("reads plain text files as utf-8", async () => {
    const buf = Buffer.from("John Doe\nReact, TypeScript", "utf-8");
    expect(await extractText(buf, "resume.txt")).toContain("React, TypeScript");
  });

  it("throws on an empty/too-short PDF (scanned)", async () => {
    // A tiny buffer that pdf-parse yields ~no text from.
    const buf = Buffer.from("%PDF-1.4\n%%EOF", "utf-8");
    await expect(extractText(buf, "scan.pdf")).rejects.toThrow(/scanned|text-based/i);
  });
});
```

- [ ] **Step 2: Run it, expect fail**

Run: `npm test -- extract-text`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** (ported from the reference repo; ESM dynamic import for pdf-parse)

`src/lib/extract-text.ts`:

```ts
import mammoth from "mammoth";

// Signals the caller should fall back to vision (image parse) for this file.
export class ScannedPdfError extends Error {}

export async function extractText(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase();

  if (ext === "pdf") {
    const pdfParse = (await import("pdf-parse")).default as (b: Buffer) => Promise<{ text: string }>;
    const text = (await pdfParse(buffer)).text.trim();
    if (text.length < 50)
      throw new ScannedPdfError(
        "Could not extract text from this PDF — it may be scanned or image-based.",
      );
    return text;
  }

  if (ext === "docx") {
    return (await mammoth.extractRawText({ buffer })).value.trim();
  }

  return buffer.toString("utf-8").trim();
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test -- extract-text`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/extract-text.ts src/lib/extract-text.test.ts
git commit -m "feat: text extraction helper (pdf/docx/txt) with scanned-pdf fallback signal"
```

---

### Task 3: Gemini parsing lib

**Files:**
- Create: `src/lib/gemini.ts`

(No unit test — thin network wrapper. Its output shape is exercised via the merge tests in Task 4.)

- [ ] **Step 1: Implement**

`src/lib/gemini.ts`:

```ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const stripFences = (s: string) =>
  s.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

export interface ParsedResume {
  candidate_name: string;
  email: string;
  phone: string;
  location: string;
  skills: string[];
  experiences: { company: string; role: string; duration: string }[];
  projects: { name: string; description: string }[];
  education: string[];
  github_urls: string[];
}

export async function parseResumeText(text: string): Promise<ParsedResume> {
  const prompt = `Extract structured data from this resume. Be exhaustive and verbatim; do NOT invent anything.
Return ONLY valid JSON, no markdown/code fences:
{
  "candidate_name": string, "email": string, "phone": string, "location": string,
  "skills": string[],
  "experiences": [{ "company": string, "role": string, "duration": string }],
  "projects": [{ "name": string, "description": string }],
  "education": string[],
  "github_urls": string[]
}
Use "" or [] for anything absent.

Resume Text:
${text}`;
  const res = await model.generateContent(prompt);
  return JSON.parse(stripFences(res.response.text().trim())) as ParsedResume;
}

/** Vision parse for image/scanned docs (licence, work-auth, etc). Returns whatever is readable. */
export async function parseDocImage(
  base64: string,
  mimeType: string,
): Promise<Record<string, unknown>> {
  const prompt = `Extract every readable field from this document image as flat JSON (key: value).
Use snake_case keys. Return ONLY valid JSON, no markdown/code fences.`;
  const res = await model.generateContent([
    prompt,
    { inlineData: { data: base64, mimeType } },
  ]);
  return JSON.parse(stripFences(res.response.text().trim())) as Record<string, unknown>;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors from `gemini.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/gemini.ts
git commit -m "feat: gemini parse lib (resume text + doc image vision)"
```

---

### Task 4: Merge helper (parsed → form fields)

**Files:**
- Create: `src/lib/resume-merge.ts`
- Test: `src/lib/resume-merge.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/resume-merge.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mergeParsed } from "@/lib/resume-merge";
import type { ParsedResume } from "@/lib/gemini";

const resume: ParsedResume = {
  candidate_name: "Jane Dev",
  email: "jane@x.com",
  phone: "555-1212",
  location: "Austin, TX",
  skills: ["React", "TypeScript"],
  experiences: [{ company: "Acme", role: "SWE", duration: "2 yrs" }],
  projects: [{ name: "Bench", description: "matcher" }],
  education: ["BS CS, UT"],
  github_urls: ["https://github.com/jane"],
};

describe("mergeParsed", () => {
  it("maps resume fields to candidate form field names", () => {
    const f = mergeParsed(resume, []);
    expect(f.full_name).toBe("Jane Dev");
    expect(f.email).toBe("jane@x.com");
    expect(f.primary_skills).toBe("React, TypeScript");
    expect(f.current_company).toBe("Acme");
    expect(f.github).toBe("https://github.com/jane");
    expect(f.education).toContain("BS CS, UT");
  });

  it("fills blanks from other docs but resume wins overlaps", () => {
    const bare = { ...resume, phone: "", location: "" };
    const f = mergeParsed(bare, [{ full_name: "IGNORED", phone_number: "999", address: "Dallas" }]);
    expect(f.full_name).toBe("Jane Dev"); // resume wins
    expect(f.phone).toBe("999"); // blank filled from doc
    expect(f.location).toBe("Dallas");
  });
});
```

- [ ] **Step 2: Run it, expect fail**

Run: `npm test -- resume-merge`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`src/lib/resume-merge.ts`:

```ts
import type { ParsedResume } from "@/lib/gemini";

// Candidate-form field names this helper can fill.
export type FormFields = Partial<Record<
  "full_name" | "email" | "phone" | "location" | "current_company" |
  "primary_skills" | "projects" | "education" | "github",
  string
>>;

// First value in `obj` whose key matches one of the patterns, coerced to string.
function pick(obj: Record<string, unknown>, patterns: RegExp[]): string {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === "") continue;
    if (patterns.some((p) => p.test(k))) return String(v);
  }
  return "";
}

/** Resume drives the form; `others` (arbitrary doc JSON) only fill blanks. */
export function mergeParsed(
  resume: ParsedResume,
  others: Record<string, unknown>[],
): FormFields {
  const f: FormFields = {
    full_name: resume.candidate_name || "",
    email: resume.email || "",
    phone: resume.phone || "",
    location: resume.location || "",
    current_company: resume.experiences?.[0]?.company || "",
    primary_skills: (resume.skills ?? []).join(", "),
    projects: (resume.projects ?? []).map((p) => `${p.name}: ${p.description}`).join("\n"),
    education: (resume.education ?? []).join("; "),
    github: resume.github_urls?.[0] || "",
  };

  const fillers: [keyof FormFields, RegExp[]][] = [
    ["full_name", [/name/i]],
    ["email", [/email/i]],
    ["phone", [/phone/i]],
    ["location", [/location|address|city/i]],
  ];
  for (const doc of others) {
    for (const [field, patterns] of fillers) {
      if (!f[field]) {
        const v = pick(doc, patterns);
        if (v) f[field] = v;
      }
    }
  }
  return f;
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test -- resume-merge`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/resume-merge.ts src/lib/resume-merge.test.ts
git commit -m "feat: merge parsed docs into candidate form fields (resume primary, docs fill blanks)"
```

---

### Task 5: Autofill server action

**Files:**
- Create: `src/app/(app)/candidates/parse-actions.ts`

- [ ] **Step 1: Implement**

`src/app/(app)/candidates/parse-actions.ts`:

```ts
"use server";

import { getCurrentProfile } from "@/lib/auth";
import { extractText, ScannedPdfError } from "@/lib/extract-text";
import { parseResumeText, parseDocImage, type ParsedResume } from "@/lib/gemini";
import { mergeParsed, type FormFields } from "@/lib/resume-merge";

const IMAGE_RE = /\.(png|jpe?g|webp|heic)$/i;

async function parseOne(file: File): Promise<
  | { kind: "resume"; parsed: ParsedResume }
  | { kind: "doc"; parsed: Record<string, unknown> }
> {
  const buffer = Buffer.from(await file.arrayBuffer());

  // Image → vision. PDF/docx/txt → text, but fall back to vision on scanned PDFs.
  if (IMAGE_RE.test(file.name)) {
    return { kind: "doc", parsed: await parseDocImage(buffer.toString("base64"), file.type || "image/jpeg") };
  }
  try {
    const text = await extractText(buffer, file.name);
    return { kind: "resume", parsed: await parseResumeText(text) };
  } catch (e) {
    if (e instanceof ScannedPdfError) {
      return { kind: "doc", parsed: await parseDocImage(buffer.toString("base64"), "application/pdf") };
    }
    throw e;
  }
}

/**
 * Parses every attached file. `resume` input is treated as the primary source;
 * all other files fill blanks. Returns merged form fields + the resume's parsed
 * JSON (to persist on save) + per-file errors (fail-soft).
 */
export async function autofillFromDocuments(formData: FormData): Promise<{
  fields: FormFields;
  resumeParsed: ParsedResume | null;
  errors: string[];
}> {
  const me = await getCurrentProfile();
  if (!me) return { fields: {}, resumeParsed: null, errors: ["Not authorized"] };

  const resumeFile = formData.getAll("doc_resume").find((v): v is File => v instanceof File && v.size > 0);
  const otherFiles = [...formData.entries()]
    .filter(([k, v]) => k.startsWith("doc_") && k !== "doc_resume" && v instanceof File && (v as File).size > 0)
    .map(([, v]) => v as File);

  const errors: string[] = [];
  let resumeParsed: ParsedResume | null = null;
  const others: Record<string, unknown>[] = [];

  if (resumeFile) {
    try {
      const r = await parseOne(resumeFile);
      if (r.kind === "resume") resumeParsed = r.parsed;
      else others.push(r.parsed);
    } catch (e) {
      errors.push(`${resumeFile.name}: ${(e as Error).message}`);
    }
  }
  for (const file of otherFiles) {
    try {
      const r = await parseOne(file);
      others.push(r.kind === "resume" ? (r.parsed as unknown as Record<string, unknown>) : r.parsed);
    } catch (e) {
      errors.push(`${file.name}: ${(e as Error).message}`);
    }
  }

  const empty: ParsedResume = {
    candidate_name: "", email: "", phone: "", location: "",
    skills: [], experiences: [], projects: [], education: [], github_urls: [],
  };
  return { fields: mergeParsed(resumeParsed ?? empty, others), resumeParsed, errors };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/candidates/parse-actions.ts"
git commit -m "feat: autofillFromDocuments server action (parse + merge)"
```

---

### Task 6: Document type bar component

**Files:**
- Create: `src/app/(app)/candidates/document-type-bar.tsx`

- [ ] **Step 1: Implement** (presentational segmented single-select, reused in both places)

`src/app/(app)/candidates/document-type-bar.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/documents";

export function DocumentTypeBar({
  value,
  onChange,
  disabled,
}: {
  value: DocumentType;
  onChange: (t: DocumentType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-md border bg-muted/40 p-1">
      {DOCUMENT_TYPES.map((d) => (
        <button
          key={d.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(d.value)}
          className={cn(
            "rounded px-3 py-1 text-sm transition-colors disabled:opacity-50",
            value === d.value
              ? "bg-background font-medium shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(app)/candidates/document-type-bar.tsx"
git commit -m "feat: DocumentTypeBar segmented selector"
```

---

### Task 7: Swap the dropdown for the bar in the detail-page documents tab

**Files:**
- Modify: `src/app/(app)/candidates/documents-tab.tsx:96-108`

- [ ] **Step 1: Replace the `<select>`** with the bar. Add import at top:

```tsx
import { DocumentTypeBar } from "@/app/(app)/candidates/document-type-bar";
```

Replace the `<select>...</select>` block (lines ~97-108) with:

```tsx
          <DocumentTypeBar value={type} onChange={setType} disabled={uploading} />
```

- [ ] **Step 2: Verify build/lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/candidates/documents-tab.tsx"
git commit -m "feat: use DocumentTypeBar instead of dropdown in documents tab"
```

---

### Task 8: Create-form document folders + Autofill wiring

**Files:**
- Modify: `src/app/(app)/candidates/candidate-form.tsx`

**Approach:** Render one hidden `<input type=file>` per document type (name `doc_<type>`), only the bar-selected one visible — files persist in the DOM inputs and ride the form's submit. Add an **Autofill from documents** button that sends those files to `autofillFromDocuments`, fills empty fields, and stashes the resume JSON in a hidden `resume_parsed` input. Only applies to the **create** form (`!candidate`).

- [ ] **Step 1: Add imports + state** near the top of `CandidateForm`:

```tsx
import { useRef, useState } from "react";
import { toast } from "sonner";
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/documents";
import { DocumentTypeBar } from "@/app/(app)/candidates/document-type-bar";
import { autofillFromDocuments } from "@/app/(app)/candidates/parse-actions";
```

Inside the component:

```tsx
  const isCreate = !candidate;
  const formRef = useRef<HTMLFormElement>(null);
  const [activeType, setActiveType] = useState<DocumentType>(DOCUMENT_TYPES[0].value);
  const [autofilling, setAutofilling] = useState(false);
```

Add `ref={formRef}` to the `<form>`.

- [ ] **Step 2: Add the Autofill handler** (fills only empty fields — never overwrites typed values):

```tsx
  async function onAutofill() {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData();
    let any = false;
    for (const d of DOCUMENT_TYPES) {
      const input = form.elements.namedItem(`doc_${d.value}`) as HTMLInputElement | null;
      for (const file of input?.files ?? []) {
        fd.append(`doc_${d.value}`, file);
        any = true;
      }
    }
    if (!any) {
      toast.error("Attach a document first.");
      return;
    }
    setAutofilling(true);
    try {
      const { fields, resumeParsed, errors } = await autofillFromDocuments(fd);
      for (const [name, value] of Object.entries(fields)) {
        const el = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
        if (el && !el.value && value) el.value = value;
      }
      const hidden = form.elements.namedItem("resume_parsed") as HTMLInputElement | null;
      if (hidden && resumeParsed) hidden.value = JSON.stringify(resumeParsed);
      errors.forEach((e) => toast.error(e));
      toast.success("Autofilled from documents — review before saving.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAutofilling(false);
    }
  }
```

- [ ] **Step 3: Add the Documents card** (create-only), before the submit row:

```tsx
      {isCreate ? (
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <DocumentTypeBar value={activeType} onChange={setActiveType} disabled={autofilling} />
            {DOCUMENT_TYPES.map((d) => (
              <div key={d.value} className={activeType === d.value ? "block" : "hidden"}>
                <Label className="mb-1.5 block">{d.label}</Label>
                <input type="file" name={`doc_${d.value}`} multiple className="text-sm" />
              </div>
            ))}
            <input type="hidden" name="resume_parsed" />
            <div>
              <Button type="button" variant="secondary" onClick={onAutofill} disabled={autofilling}>
                {autofilling ? <Loader2 className="animate-spin" /> : null}
                Autofill from documents
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
```

- [ ] **Step 4: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/candidates/candidate-form.tsx"
git commit -m "feat: document folders + Autofill from documents in create form"
```

---

### Task 9: Persist files + resume JSON on create

**Files:**
- Modify: `src/app/(app)/candidates/actions.ts` (`createCandidate`)

**Approach:** After the candidate row is inserted, upload each `doc_<type>` file server-side to `candidate-docs/{id}/...` and insert `documents` rows; the resume row gets `parsed_data` from the `resume_parsed` hidden field.

- [ ] **Step 1: Add a helper + extend `createCandidate`.** Add import:

```ts
import { DOCUMENT_BUCKET, DOCUMENT_TYPES } from "@/lib/documents";
```

Add above `createCandidate`:

```ts
async function saveCandidateDocs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  candidateId: string,
  uploaderId: string,
) {
  const resumeParsedRaw = String(formData.get("resume_parsed") ?? "");
  for (const d of DOCUMENT_TYPES) {
    const files = formData.getAll(`doc_${d.value}`).filter(
      (v): v is File => v instanceof File && v.size > 0,
    );
    for (const file of files) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${candidateId}/${Date.now()}-${safe}`;
      const up = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, file);
      if (up.error) continue; // fail-soft: don't block candidate creation on a file
      await supabase.from("documents").insert({
        candidate_id: candidateId,
        type: d.value,
        file_name: file.name,
        storage_path: path,
        size_bytes: file.size,
        uploaded_by: uploaderId,
        parsed_data: d.value === "resume" && resumeParsedRaw ? JSON.parse(resumeParsedRaw) : null,
      });
    }
  }
}
```

In `createCandidate`, after the successful insert (`if (error) return ...`) and **before** `revalidatePath`, add:

```ts
  await saveCandidateDocs(supabase, formData, data.id, me.id);
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/candidates/actions.ts"
git commit -m "feat: persist attached documents + resume parsed_data on candidate create"
```

---

### Task 10: Manual verification

- [ ] **Step 1:** Run the migration in Supabase (Task 1 manual step) if not already done.
- [ ] **Step 2:** `npm run dev`, go to **Candidates → New**.
- [ ] **Step 3:** In the Documents card, click **Resume** in the bar, attach a text-based resume PDF/docx.
- [ ] **Step 4:** Click **Autofill from documents** → confirm name/email/skills/etc. populate (empty fields only) and a success toast shows.
- [ ] **Step 5:** Optionally attach a licence/work-auth image under its folder.
- [ ] **Step 6:** Edit anything, then **Save candidate**.
- [ ] **Step 7:** On the detail page → **Documents** tab: confirm the files are listed with the right type badges, and the type picker is now a bar.
- [ ] **Step 8:** In Supabase, confirm the resume's `documents.parsed_data` holds JSON and other docs' `parsed_data` is null.
- [ ] **Step 9:** `npm test` — all green.

---

## Self-review notes

- **Spec coverage:** bar (T6/T7/T8), autofill parses all docs (T5), resume primary + fill blanks + no overwrite (T4 + T8 empty-check), resume-only persistence (T9 `parsed_data` only on resume row), image/scanned vision (T3/T5), migration (T1). ✓
- **Types:** `ParsedResume` (T3) consumed by T4/T5; `FormFields` (T4) returned by T5, consumed by T8; `DocumentType`/`DOCUMENT_TYPES` reused from `src/lib/documents.ts`. ✓
- **Deferred:** Feature B (job-title skill search) — separate spec/plan on this branch.

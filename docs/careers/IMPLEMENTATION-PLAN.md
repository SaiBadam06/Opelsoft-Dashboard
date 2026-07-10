# Careers platform — implementation plan

**Status:** Approved for execution  
**Last updated:** 2026-07-06  
**Tracker:** [TRACKER.md](./TRACKER.md)  
**URLs:** [URL-STRATEGY.md](./URL-STRATEGY.md)

---

## Goals

1. Recruiters create **internal requirements** in StaffingOS (unchanged model).
2. Recruiters publish **sanitized job postings** to branded careers pages.
3. Candidates apply on **`{company-domain}/careers`** — not on the dashboard URL.
4. Applications flow into an **Applications** queue → **candidates** → **submissions** pipeline.
5. **No `organizations` table now** — design is org-ready via `career_sites` + future `org_id` columns.
6. **Job boards** (LinkedIn, Indeed, etc.) — schema + disabled UI only; no API work now.

---

## Architecture

```text
INTERNAL (dashboard, auth required)          PUBLIC (no auth)
────────────────────────────────────       ─────────────────────────────
requirements                               Host: opelsoft.com
    │                                        Path: /careers
    └── job_postings (sanitized)                 │
            │                                    ▼
            └── posting_distributions ──►  list + detail + apply
                    │
                    ├── careers_site + career_sites row
                    ├── linkedin (inactive)
                    └── indeed (inactive)

job_applications → /applications → candidates → submissions → /logs
```

### Core tables (migration `0008`)

| Table | Role |
|-------|------|
| `distribution_channels` | Registry: `careers_site`, `linkedin`, `indeed`, … |
| `career_sites` | Brand + domain + hero/branding |
| `job_postings` | Public job record (never expose `requirements` to anon) |
| `posting_distributions` | Where a posting is live (per channel + optional `career_site_id`) |
| `job_applications` | Inbound applicants |

### Khushi repo — what to port

| Pattern | Phase | StaffingOS location |
|---------|-------|---------------------|
| Public job cards + search | 1 | `/careers` list |
| Job detail + JD bullets | 1 | `/careers/jobs/[slug]` |
| Apply form + resume | 2 | `/careers/jobs/[slug]/apply` |
| JD PDF/DOCX drag/drop | 3 | Requirement new/edit form |
| Express API | — | **Do not port** — Server Actions |

---

## UI/UX standards

### Public careers
- Layout: `src/app/careers/layout.tsx` — no app sidebar
- Branding from `career_sites`: logo, `primary_color`, hero copy
- Components: header, job card, search, apply form
- Mobile-first; skeleton loaders; clear empty states
- Footer: subtle “Powered by StaffingOS” (configurable later)

### Internal dashboard
- Reuse existing patterns: `Card`, `Field`, `Badge`, `sonner` toasts
- New **Careers posting** card on `/requirements/[id]`
- New **Applications** in sidebar (`Inbox` icon)
- Admin: **Career sites** settings at `/settings/career-sites`

---

# PHASE 0 — Foundation (schema only)

**Sprint:** A (start)  
**User-visible:** None  
**Est:** 1 day

### 0.1 Database `0008_careers_foundation.sql`

- [ ] Enums: `job_posting_status`, `workplace_type`, `job_application_status`
- [ ] `distribution_channels` + seeds (`careers_site` active; `linkedin`, `indeed`, `other` inactive)
- [ ] `career_sites` + seeds: `opelsoft`, `futurestack`, `talent2meet`
- [ ] `job_postings` (no `career_site_id` on posting — use distributions)
- [ ] `posting_distributions`
- [ ] `job_applications` (+ `distribution_id`, `source`)
- [ ] Storage bucket `application-resumes` (private)
- [ ] RPC/view `get_public_jobs(resolved_site_id)` / `get_public_job(site, slug)`
- [ ] RLS: anon cannot read `requirements`; anon read published postings via view/RPC only
- [ ] Apply migration to Supabase

### 0.2 App wiring

- [ ] `src/lib/career-constants.ts`
- [ ] `src/lib/career-sites.ts` — `resolveCareerSite(host, searchParams)`
- [ ] `src/lib/supabase/proxy.ts` — public `/careers` paths
- [ ] `DEFAULT_CAREER_SITE_SLUG=opelsoft` in `.env.example`

**Exit:** RPC returns empty list for Opelsoft; dashboard unchanged.

---

# PHASE 1 — Public careers (read-only, Opelsoft)

**Sprint:** A  
**Public URL (dev):** `http://localhost:3000/careers`  
**Public URL (prod target):** `https://opelsoft.com/careers`  
**Est:** 2 days

### 1A — Careers list

**Route:** `src/app/careers/page.tsx`  
**Layout:** `src/app/careers/layout.tsx`

**UI:**
```text
[Logo]  Careers at Opelsoft
Hero headline + subtext (from career_sites)
[ Search jobs... ]
┌─────────────┐ ┌─────────────┐
│ Job title   │ │ ...         │
│ Remote·C2C  │ │             │
│ View role → │ │             │
└─────────────┘ └─────────────┘
```

- [ ] `listPublicJobs(siteId)` via RPC
- [ ] `CareersSiteHeader`, `CareersJobCard`, `CareersJobSearch`
- [ ] Client-side search (title, location, skills) — Khushi pattern
- [ ] Workplace badges (remote/hybrid/onsite)
- [ ] Loading skeletons + empty state
- [ ] `?site=futurestack` dev override documented

### 1B — Job detail

**Route:** `src/app/careers/jobs/[jobSlug]/page.tsx`

- [ ] `getPublicJob(siteId, jobSlug)`
- [ ] `buildBulletPoints()` in `src/lib/career-jd.ts` (from Khushi)
- [ ] Breadcrumb: Careers → Job title
- [ ] Apply CTA placeholder (disabled until Phase 2)
- [ ] 404 for draft/closed/wrong slug
- [ ] SEO `metadata` (title, description)

**Exit:** Manually seed one published posting → visible at `/careers` on localhost.

---

# PHASE 2 — Publish + Apply + Applications

**Sprint:** B + C  
**Est:** 4 days

### 2A — Dashboard: Careers posting card

**Where:** `/requirements/[id]` — new card

**UI:**
```text
┌─ Careers posting ─────────────────────────────┐
│ Status: Draft | Published | Closed            │
│ Public title, location, workplace, employment│
│ Public description (prefill from notes)       │
│ Skills                                        │
│ Distribute to:                                │
│   [x] Opelsoft careers                        │
│   [ ] Futurestack  [ ] Talent2Meet            │
│   [ ] LinkedIn (Coming soon)  [ ] Indeed      │
│ [Save draft] [Publish] [View on careers →]    │
└───────────────────────────────────────────────┘
```

- [ ] `JobPostingCard` component
- [ ] Server actions: save, publish, close
- [ ] Slug generator
- [ ] `posting_distributions` per checked career site
- [ ] “View on careers” uses [URL-STRATEGY](./URL-STRATEGY.md) link builder
- [ ] `revalidatePath('/careers')` on publish

### 2B — Apply flow (public)

**Route:** `src/app/careers/jobs/[jobSlug]/apply/page.tsx`

**Fields:** name*, email*, phone, location, LinkedIn, portfolio, resume*, cover note

- [ ] `CareersApplyForm` (client) + `applyToJob` server action
- [ ] Resume → private `application-resumes` bucket
- [ ] Thank-you page
- [ ] Enable Apply CTA on detail page
- [ ] Honeypot anti-spam field

### 2C — Applications queue (dashboard)

**Route:** `/applications`, `/applications/[id]`  
**Nav:** Add “Applications” to `NAV_ITEMS`

- [ ] Table: candidate, job, site, status, date
- [ ] Filters: status, career site, search
- [ ] Detail: resume download, status actions
- [ ] Convert to candidate (+ attach resume to `candidate-docs`)
- [ ] Application status badges

**Exit:** Publish → apply on `/careers` → see in Applications → convert to candidate.

---

# PHASE 3 — JD document parsing (Khushi)

**Sprint:** D  
**Est:** 1.5 days

**Where:** `/requirements/new`, `/requirements/[id]/edit`

- [ ] `JdDropzone` — drag/drop PDF/DOCX
- [ ] Server Action: `pdf-parse` + `mammoth`
- [ ] Fill `requirements.notes`; offer “Copy to public description” on posting card
- [ ] Parse errors: wrong type, empty extract, scanned PDF message
- [ ] **No auto-publish**

---

# PHASE 4 — Multi-brand (Futurestack, Talent2Meet)

**Sprint:** E  
**Est:** 1 day

### 4A — Career site settings (admin)

**Route:** `/settings/career-sites`

- [ ] Tabs per site: Opelsoft, Futurestack, Talent2Meet
- [ ] Edit: name, hero, logo upload, primary color, active flag
- [ ] `domain` field (optional until DNS)
- [ ] Preview link: `/careers?site={slug}`

### 4B — Multi-site publish

- [ ] Posting card checkboxes → multiple `posting_distributions`
- [ ] Each domain shows only its site’s published jobs (when DNS wired)
- [ ] Dev test: `?site=futurestack` shows different branding

**Exit:** Three brands visually distinct; jobs can target one or more sites.

---

# PHASE 5 — Distribution channels UI (boards disabled)

**Sprint:** E (partial)  
**Est:** 0.5 day

- [x] Read channels from DB; render LinkedIn/Indeed as disabled + “Coming soon”
- [x] `/settings/channels` read-only admin list
- [x] No `posting_distributions` rows for inactive channels
- [x] `job_applications.source` ready for `linkedin`, `indeed` later

---

# PHASE 6 — Pipeline bridge

**Sprint:** C (tail)  
**Est:** 1 day

- [ ] From application/candidate: “Create submission” (pre-fill requirement)
- [ ] Submission starts at `matched` or `submitted`
- [ ] Status changes appear in `/logs`

---

# PHASE 7 — Production URLs + polish

**Sprint:** F  
**Est:** 1–2 days

### Production readiness checklist

Use this before M5 (`opelsoft.com/careers` live). Code paths are largely ready; remaining work is infra + data.

| Step | Owner | Status | Notes |
|------|-------|--------|-------|
| **DNS / routing** | Infra | pending | Map `opelsoft.com/careers*` → Cloud Run (path-based URL map or reverse proxy). Dashboard stays on `*.run.app`. |
| **`career_sites.domain`** | Admin | pending | Set `opelsoft.com` on Opelsoft row via `/settings/career-sites`. Repeat per brand when DNS ready. |
| **Env vars** | Deploy | pending | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` (dashboard URL), `DEFAULT_CAREER_SITE_SLUG=opelsoft` |
| **Host resolution** | Code | ready | `resolveCareerSite()` in `career-sites.ts`: host → `career_sites.domain`, then env fallback. `?site=` restricted to localhost / `*.run.app` in `proxy.ts`. |
| **Public paths** | Code | ready | `/careers` routes are unauthenticated in `proxy.ts`. |
| **SEO** | Code | partial | `generateMetadata` on list, detail, apply (apply is `noindex`). OG tags on list + detail. Full OG images deferred. |
| **Smoke test** | QA | pending | Publish job → browse `https://opelsoft.com/careers` → apply → row in `/applications` |

### Tasks

- [ ] DNS: `opelsoft.com/careers` → Cloud Run (path map or proxy)
- [ ] Set `career_sites.domain` for Opelsoft
- [ ] Remove reliance on `?site=` in production (enforced in proxy — marketing domains ignore override)
- [ ] OG/meta tags for job sharing (basic title/description done; image cards optional)
- [ ] Dashboard metric: “Applications this week”
- [ ] Mobile QA on apply flow
- [ ] Deploy + smoke test on real domain

---

# DEFERRED

| ID | Item | Notes |
|----|------|-------|
| D1 | `organizations` + `organization_members` | Add `org_id` later; backfill Opelsoft |
| D2 | LinkedIn / Indeed API sync | Uses `posting_distributions.external_id` |
| D3 | `careers.opelsoft.com` subdomain | Alternative to path on root domain |
| D4 | AI skills extraction | After basic JD parse |
| D5 | Self-serve tenant onboarding | After organizations |

---

# File map (expected)

```text
docs/careers/                          ← this folder
supabase/migrations/0008_careers_foundation.sql

src/lib/career-constants.ts
src/lib/career-sites.ts
src/lib/career-jd.ts
src/lib/job-postings.ts
src/lib/job-applications.ts

src/app/careers/layout.tsx
src/app/careers/page.tsx
src/app/careers/jobs/[jobSlug]/page.tsx
src/app/careers/jobs/[jobSlug]/apply/page.tsx

src/app/(app)/applications/...
src/app/(app)/requirements/job-posting-card.tsx
src/app/(app)/requirements/posting-actions.ts
src/app/(app)/settings/career-sites/...
src/app/(app)/settings/channels/...

src/components/careers/...
```

---

# Sprint summary

| Sprint | Phases | Deliverable |
|--------|--------|-------------|
| **A** | 0 + 1 | `/careers` live (read-only), Opelsoft dev |
| **B** | 2A + 2B | Publish from dashboard + apply |
| **C** | 2C + 6 | Applications queue + submission bridge |
| **D** | 3 | JD PDF/DOCX import |
| **E** | 4 + 5 | 3 brands + disabled job board UI |
| **F** | 7 | `opelsoft.com/careers` + polish |

**Reference:** Update [TRACKER.md](./TRACKER.md) when starting or completing each phase.

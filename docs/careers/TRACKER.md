# Careers platform — tracker

Update this file as phases complete. Full detail: [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md).

**Last updated:** 2026-07-06  
**Current focus:** Sprint F code polish complete — M5 blocked on DNS/deploy (user action)

---

## Overall status

| Sprint | Scope | Status | Target URL |
|--------|--------|--------|------------|
| **A** | Schema + public list/detail | `done` | `localhost:3000/careers` |
| **B** | Publish + apply | `done` | `/requirements/[id]` + apply flow |
| **C** | Applications + submissions bridge | `done` | `/applications` |
| **D** | JD PDF/DOCX parse | `done` | Requirement new/edit form |
| **E** | Multi-brand + channel UI | `done` | `?site=futurestack` + `/settings/channels` |
| **F** | `opelsoft.com/careers` + polish | `in_progress` | `opelsoft.com/careers` |

**Legend:** `not_started` | `in_progress` | `done` | `blocked`

---

## Blockers

_None — migration 0008 applied manually 2026-07-06._

---

## Phase checklist

### Phase 0 — Foundation

| ID | Task | Status | Owner | Notes |
|----|------|--------|-------|-------|
| 0.1 | Migration `0008_careers_foundation.sql` | done | | File in `supabase/migrations/` |
| 0.2 | Apply migration to Supabase | done | | Applied via Supabase Dashboard SQL |
| 0.3 | `career-constants.ts` + `career-sites.ts` | done | | Host + `?site=` + env fallback |
| 0.4 | Proxy: public `/careers` | done | | `src/lib/supabase/proxy.ts` |
| 0.5 | `DEFAULT_CAREER_SITE_SLUG` in env example | done | | `.env.example` |

### Phase 1 — Public careers (read-only)

| ID | Task | Status | Owner | Notes |
|----|------|--------|-------|-------|
| 1A.1 | `listPublicJobs` data layer | done | | `src/lib/job-postings.ts` + RPC |
| 1A.2 | Careers layout + header branding | done | | `src/app/careers/layout.tsx` |
| 1A.3 | `/careers` list + search | done | | Client search in `CareersJobList` |
| 1B.1 | `getPublicJob` + JD bullets | done | | `career-jd.ts` + tests |
| 1B.2 | `/careers/jobs/[jobSlug]` detail | done | | Apply CTA enabled (Phase 2B) |
| 1B.3 | Vitest helpers | done | | `career-jd.test.ts` |

### Phase 2 — Publish + apply + applications

| ID | Task | Status | Owner | Notes |
|----|------|--------|-------|-------|
| 2A.1 | Posting server actions | done | | `posting-actions.ts` |
| 2A.2 | `JobPostingCard` on requirement detail | done | | `job-posting-card.tsx` |
| 2A.3 | Distribution checklist UI | done | | Career sites + LinkedIn/Indeed disabled |
| 2B.1 | Apply form + server action | done | | `careers-apply-form.tsx`, `apply-actions.ts` |
| 2B.2 | Thank-you page + resume storage | done | | Service-role upload to `application-resumes` |
| 2C.1 | `/applications` list + filters | done | | `applications-table.tsx` |
| 2C.2 | Convert to candidate flow | done | | Resume copied to `candidate-docs` |

### Phase 3 — JD parsing

| ID | Task | Status | Owner | Notes |
|----|------|--------|-------|-------|
| 3.1 | `JdDropzone` + parse action | done | | `pdf-parse` + `mammoth` |
| 3.2 | Requirement form integration | done | | New + edit forms |

### Phase 4 — Multi-brand

| ID | Task | Status | Owner | Notes |
|----|------|--------|-------|-------|
| 4.1 | `/settings/career-sites` admin | done | | Tabs per site; admin-only |
| 4.2 | Multi-site publish checkboxes | done | | On `JobPostingCard` |
| 4.3 | Futurestack + Talent2Meet visual QA | done | | DB branding verified; `?site=` via proxy header |

### Phase 5 — Channels UI (boards disabled)

| ID | Task | Status | Owner | Notes |
|----|------|--------|-------|-------|
| 5.1 | LinkedIn/Indeed disabled in UI | done | | On posting card |
| 5.2 | `/settings/channels` read-only | done | | Admin table; links to career sites |

### Phase 6 — Pipeline bridge

| ID | Task | Status | Owner | Notes |
|----|------|--------|-------|-------|
| 6.1 | Create submission from application | done | | `createSubmissionFromApplication` + UI button |

### Phase 7 — Production + polish

| ID | Task | Status | Owner | Notes |
|----|------|--------|-------|-------|
| 7.1 | DNS `opelsoft.com/careers` | not_started | user | Cloud Run path map / reverse proxy |
| 7.2 | `career_sites.domain` for Opelsoft | not_started | user | Set `opelsoft.com` in `/settings/career-sites` after DNS |
| 7.3 | SEO/OG + dashboard metric | done | | `careers-metadata.ts`; Twitter/OG on list+detail; logo OG image; dashboard "Applications This Week" |
| 7.4 | Production smoke test | not_started | user | Blocked on M5 deploy |

---

## Deferred (do not track in active sprints)

- [ ] `organizations` + `organization_members`
- [ ] LinkedIn / Indeed API integration
- [ ] Custom subdomain `careers.opelsoft.com`
- [ ] AI JD skills extraction

---

## Milestones

| Milestone | Criteria | Status |
|-----------|----------|--------|
| **M1** | `/careers` shows seeded published job (localhost) | **done** | RPC + seed verified |
| **M2** | Recruiter publishes from requirement detail | **done** | Migration live; posting card ready |
| **M3** | Candidate applies; row in Applications | **done** | `npm run test:careers-apply` — storage + `job_applications` row |
| **M4** | Convert application → candidate → submission | **done** | `npm run test:careers-bridge` — requirement link + submission insert |
| **M5** | `opelsoft.com/careers` live in production | not_started | DNS + domain config + smoke test (user/infra) |
| **M6** | Futurestack + Talent2Meet branded dev preview | **done** | `npm run test:careers-branding`; browse `?site=futurestack` |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-06 | Plan created. URL strategy: domain-based `/careers` (not `/careers/opelsoft` on prod). |
| 2026-07-06 | Sprint A implemented: migration 0008 file, public `/careers` routes, lib layer, demo seed script. |
| 2026-07-06 | Phase 2A/2B + Phase 3 implemented (code). Migration blocked — CLI hang + MCP read-only. |
| 2026-07-06 | Migration 0008 applied manually. Seed verified. Phase 2C (applications queue) + Phase 4.1 (career sites settings) implemented. |
| 2026-07-06 | Sprint C verified: `test:careers-apply`, `test:careers-bridge`, `test:careers-branding` scripts; M3/M4/M6 done. |
| 2026-07-06 | Sprint E done: `/settings/channels` read-only admin; Phase 7 prep (production checklist, `?site=` gated, careers SEO metadata). |
| 2026-07-06 | Sprint F (code): dashboard "Applications This Week" metric; careers SEO polish (canonical, Twitter, logo OG); mobile apply-form tweaks. M5 still blocked on DNS/deploy. |

---

## Verify locally

```bash
npm run seed:careers-demo
npm run test:careers-apply      # M3 — job_applications row + resume upload
npm run test:careers-bridge     # M4 — candidate + submission from application
npm run test:careers-branding   # Phase 4.3 — futurestack + talent2meet data
npm run dev
# → http://localhost:3000/careers
# → http://localhost:3000/careers?site=futurestack
# → http://localhost:3000/careers/jobs/senior-java-developer
# → http://localhost:3000/careers/jobs/senior-java-developer/apply
# → http://localhost:3000/applications
# → http://localhost:3000/settings/career-sites (admin)
# → http://localhost:3000/settings/channels (admin)
```

## Verification (2026-07-06)

- Migration 0008 — tables + RPC confirmed via Supabase MCP (`career_sites`, `job_postings`, `job_applications`, etc.)
- `npm run seed:careers-demo` — success (existing posting `senior-java-developer`)
- `get_public_jobs(opelsoft)` — returns 1 published job
- `npm run test:careers-apply` — PASS (resume upload + `job_applications` insert)
- `npm run test:careers-bridge` — PASS (linked `requirement_id`, candidate + submission insert)
- `npm run test:careers-branding` — PASS (futurestack `#7c3aed`, talent2meet `#059669`)
- `npm test` — 23 passed
- `npx tsc --noEmit` — pass
- `npm run build` — pass (includes `/applications`, `/settings/career-sites`)

## Verification (2026-07-06, Sprint F code)

- Phase 7.3: `applicationsThisWeek` on dashboard (`job_applications` since Monday)
- Phase 7.3: `careers-metadata.ts` — OG/Twitter/canonical on `/careers` + job detail; logo as OG image when set
- Mobile: apply form full-width inputs/buttons, touch-friendly heights, breadcrumb truncation
- `npm test` / `tsc` / `build` — pass (23 tests, Sprint F 2026-07-06)

# Careers URL strategy

**Status:** Approved  
**Last updated:** 2026-07-06

## Rule

On a company’s **marketing domain**, careers URLs are **short paths** — the **domain** identifies the brand, not the path.

```text
✅ https://opelsoft.com/careers
✅ https://opelsoft.com/careers/jobs/senior-java-developer
✅ https://opelsoft.com/careers/jobs/senior-java-developer/apply

❌ https://opelsoft.com/careers/opelsoft
❌ https://opelsoft-dashboard-….run.app/careers   (production marketing — use real domain)
```

Same pattern for other brands:

| Brand | Careers home | Job detail |
|-------|----------------|------------|
| Opelsoft | `opelsoft.com/careers` | `opelsoft.com/careers/jobs/{slug}` |
| Futurestack | `futurestack.com/careers` | `futurestack.com/careers/jobs/{slug}` |
| Talent2Meet | `talent2meet.com/careers` | `talent2meet.com/careers/jobs/{slug}` |

---

## App routes (code)

One route tree for all brands:

```text
/careers
/careers/jobs/[jobSlug]
/careers/jobs/[jobSlug]/apply
```

**Site resolution** happens in middleware or layout — not in the public path.

```text
resolveCareerSite(request):
  1. Host header → career_sites.domain (e.g. opelsoft.com)
  2. Dev override → ?site=futurestack (localhost / Cloud Run only)
  3. Dev default → DEFAULT_CAREER_SITE_SLUG env (default: opelsoft)
  4. Else → 404 or “careers not configured”
```

---

## Environments

| Environment | Host | How site is resolved | Example |
|-------------|------|----------------------|---------|
| **Production (Opelsoft)** | `opelsoft.com` | `career_sites.domain` | `/careers` |
| **Production (Futurestack)** | `futurestack.com` | `career_sites.domain` | `/careers` |
| **StaffingOS app (internal)** | `opelsoft-dashboard-….run.app` | Not a careers domain — dashboard only | `/dashboard`, `/requirements` |
| **Local dev** | `localhost:3000` | `DEFAULT_CAREER_SITE_SLUG` or `?site=` | `/careers`, `/careers?site=futurestack` |
| **Staging / QA** | Cloud Run URL | `?site=opelsoft` etc. | `/careers?site=opelsoft` |

### Dev-only preview (optional)

For testing multiple brands on one host without query params:

```text
/careers/preview/[siteSlug]/jobs/[jobSlug]   ← dev/staging only; noindex
```

Do **not** use `/careers/[siteSlug]` on production marketing domains.

---

## DNS / hosting (later phases)

| Step | Action |
|------|--------|
| 1 | Keep building on StaffingOS Cloud Run app |
| 2 | Map `opelsoft.com/careers*` → Cloud Run (path-based mapping or reverse proxy) |
| 3 | Set `career_sites.domain = 'opelsoft.com'` for Opelsoft row |
| 4 | Repeat per brand domain |

Alternative: `careers.opelsoft.com` subdomain → same app; still no slug in path.

---

## Dashboard links

When recruiter clicks **“View on careers site”**:

```text
production: https://{career_sites.domain}/careers/jobs/{public_slug}
dev:        http://localhost:3000/careers/jobs/{public_slug}?site={slug}
```

---

## Related tables

- `career_sites.slug` — internal key (`opelsoft`, `futurestack`, `talent2meet`)
- `career_sites.domain` — public host (`opelsoft.com`); null until DNS wired
- `distribution_channels` — `careers_site` vs `linkedin` / `indeed` (inactive for now)

See [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md) for schema and phases.

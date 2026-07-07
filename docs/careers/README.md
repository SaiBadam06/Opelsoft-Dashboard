# Careers platform — documentation

StaffingOS careers: public job boards, applications, and distribution to owned sites (and job boards later).

| Doc | Purpose |
|-----|---------|
| [URL-STRATEGY.md](./URL-STRATEGY.md) | Production vs dev URLs, domain routing |
| [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md) | Full phased plan with UI/UX and subphases |
| [TRACKER.md](./TRACKER.md) | Live status — update as work completes |

**Reference repo (patterns only):** [OpelsoftDT-Recruitment](https://github.com/Khushi0126-p/OpelsoftDT-Recruitment) — JD parse, public job cards, apply form UX.

**Not in scope yet:** `organizations`, LinkedIn/Indeed API sync, custom domains (DNS).

**Internal dashboard:** unchanged auth; new **Applications** nav and **Careers posting** on requirement detail.

## Quick start (Sprint A)

```bash
npx supabase db push          # apply 0008_careers_foundation
npm run seed:careers-demo     # one published job on Opelsoft
npm run dev                   # http://localhost:3000/careers
```

Dev brand override: `?site=futurestack` or `?site=talent2meet`. See [URL-STRATEGY.md](./URL-STRATEGY.md).

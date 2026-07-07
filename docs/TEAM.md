# StaffingOS — Developer runbook

> **Employees (recruiters):** use **[EMPLOYEE-GUIDE.md](./EMPLOYEE-GUIDE.md)** — not this file.

## Careers platform (in progress)

Public careers URLs use **company domains**, not dashboard paths:

- Production target: `https://opelsoft.com/careers`
- Plan & tracker: **[docs/careers/](./careers/README.md)** ([TRACKER.md](./careers/TRACKER.md))

## Production
| Item | Value |
|------|--------|
| **App URL** | https://opelsoft-dashboard-ulla3fdzha-uc.a.run.app |
| **Hosting** | Google Cloud Run (`staffingos-500618`) |
| **Database** | Supabase `zhohylkyzuqawpygmjbf` |
| **Repo** | https://github.com/snsettitech/Opelsoft-Dashboard |
| **Branch** | `main` |

## Local development

```bash
git clone https://github.com/snsettitech/Opelsoft-Dashboard.git
cd Opelsoft-Dashboard
cp .env.example .env.local   # fill in values
npm install
npm run dev
```

Open http://localhost:3000. Admin seed credentials are in `.env.local` (`SEED_ADMIN_*`).

## Deploy to production

Only the designated deployer runs production deploy. See **[DEPLOY.md](./DEPLOY.md)**.

```bash
export GCP_PROJECT_ID=staffingos-500618
export GCP_REGION=us-central1
export SITE_URL=https://opelsoft-dashboard-ulla3fdzha-uc.a.run.app
# + SUPABASE_URL, SUPABASE_ANON_KEY, SMTP_USER, SMTP_FROM

./scripts/deploy-cloudrun.sh
```

After deploy: verify https://opelsoft-dashboard-ulla3fdzha-uc.a.run.app/login returns 200.

## Environment variables

Copy `.env.example` → `.env.local`. Categories:

- **Supabase** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Site** — `NEXT_PUBLIC_SITE_URL`, `SITE_URL` (must match Cloud Run URL in prod)
- **SMTP** — `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- **Jira scripts** — `JIRA_EMAIL`, `JIRA_API_TOKEN` (local only, not deployed)

Production secrets live in **GCP Secret Manager** (see DEPLOY.md).

## Database

Migrations: `supabase/migrations/0001`–`0008` (profiles, candidates, vendors, requirements, submissions, interviews, placements, tasks, documents, careers).

```bash
npm run seed        # admin user
npm run seed:all    # sample data
```

## Jira

Board: https://personaon.atlassian.net/jira/software/projects/STAF/boards/34

## Contacts

- **GCP / Cloud Run** — team deployer with `gcloud` access to `staffingos-500618`
- **Supabase** — project admins for `zhohylkyzuqawpygmjbf`
- **Microsoft 365 / Graph** (future email module) — IT for app registration

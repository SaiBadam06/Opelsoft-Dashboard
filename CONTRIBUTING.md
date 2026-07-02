# Contributing to OpelSoft Dashboard

This project runs on **one live environment** (Google Cloud Run) and **one Supabase
project**. There is no staging server. These rules keep changes safe without extra
infrastructure.

## Who does what

| Role | Responsibility |
|------|----------------|
| **All developers** | Work on feature branches, open PRs, test locally, respond to review |
| **Reviewers** | Check PRs when asked; CI must be green before merge |
| **Deployer** (admin) | Sole person who runs production deploy after a PR is merged |

Only the designated deployer runs `./scripts/deploy-cloudrun.sh` or the commands in
[DEPLOY.md](./DEPLOY.md).

---

## Branch rules (required)

### Never push directly to `main`

GitHub branch protection applies to `main`. Use a feature branch and a pull request.

**Admin note:** repo admins can bypass protection when needed. GitHub still does not
allow self-approval on PRs — merge your own PR directly or use admin bypass.

### Feature branch naming

```
feature/short-description
fix/short-description
chore/short-description
```

### Workflow

```text
1. git checkout main
2. git pull
3. git checkout -b feature/your-change
4. … make changes …
5. npm run lint && npm run test && npm run build
6. git push -u origin feature/your-change
7. Open a Pull Request → main
8. Wait for CI (green)
9. Merge
10. Deployer runs Cloud Run deploy when ready
```

---

## Before you open a PR

```bash
npm ci
npm run lint
npm run test
npm run build
```

`npm run build` needs `.env.local` with Supabase public keys (or the same placeholders CI uses).

When your change touches UI or auth:

```bash
npm run dev
```

---

## Pull request requirements

1. **Target** `main`
2. **Pass CI** — lint, unit tests, and production build
3. **Use the PR template** — fill in every checklist item
4. **Stay focused** — one logical change per PR when possible

Peer review is encouraged but not required for admins to merge.

---

## Database and Supabase (one shared project)

1. **Never run experimental SQL** during business hours without team agreement
2. **Add migrations** as new numbered files in `supabase/migrations/`
3. **Back up** via Supabase dashboard before risky schema changes

---

## Secrets and environment

- **Never commit** `.env.local`, service-role keys, SMTP passwords, or deploy keys
- Production secrets live in **Google Secret Manager** (see [DEPLOY.md](./DEPLOY.md))

---

## Deploying to production (Cloud Run)

Deploy is **manual** and **not automatic** on merge.

One-time setup: [DEPLOY.md](./DEPLOY.md) (APIs, Artifact Registry, Secret Manager).

**Redeploy after a merged PR:**

```bash
./scripts/deploy-cloudrun.sh
```

### Deploy checklist (deployer)

- [ ] PR merged to `main`
- [ ] CI was green on the merged commit
- [ ] Supabase Auth redirect URLs match the Cloud Run service URL
- [ ] Post-deploy smoke test: login, one critical page, invite/email if mail changed

---

## CI (GitHub Actions)

On every PR and push to `main`: lint, test, build.

Required status check: **`CI / ci`**

See [.github/BRANCH_PROTECTION.md](./.github/BRANCH_PROTECTION.md) for admin setup.

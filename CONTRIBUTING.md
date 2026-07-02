# Contributing to OpelSoft Dashboard

This project runs on **one live environment** and **one Supabase project**. There is no
staging server. These rules keep changes safe without extra infrastructure.

## Who does what

| Role | Responsibility |
|------|----------------|
| **All developers** | Work on feature branches, open PRs, test locally, respond to review |
| **Reviewers** | Approve only after CI is green and the checklist below is satisfied |
| **Deployer** (admin) | Sole person who runs production deploy after a PR is merged |

Do not run `scripts/deploy-gce.sh` or Cloud Run deploy unless you are the designated deployer.

---

## Branch rules (required)

### Never push directly to these branches

- `feat/phase1-foundation` (current integration branch)
- `main` (when adopted for releases)

GitHub branch protection enforces this. Use a feature branch and a pull request.

### Feature branch naming

```
feature/short-description
fix/short-description
chore/short-description
```

Examples: `feature/candidate-export`, `fix/login-redirect`

### Workflow

```text
1. git checkout feat/phase1-foundation
2. git pull
3. git checkout -b feature/your-change
4. … make changes …
5. npm run lint && npm run test && npm run build   (see below)
6. git push -u origin feature/your-change
7. Open a Pull Request → feat/phase1-foundation
8. Wait for CI (green) + 1 approval
9. Merge (squash or merge commit — team default: squash)
10. Deployer deploys to production when ready
```

---

## Before you open a PR

Run locally from the project root:

```bash
npm ci
npm run lint
npm run test
npm run build
```

`npm run build` needs `.env.local` with Supabase public keys (or the same placeholders CI uses).

Manual smoke test when your change touches UI or auth:

```bash
npm run dev
```

Sign in and verify the affected pages still work.

---

## Pull request requirements

Every PR must:

1. **Target** `feat/phase1-foundation` (not a direct push to that branch)
2. **Pass CI** — lint, unit tests, and production build
3. **Get at least one approval** from a teammate (not yourself)
4. **Use the PR template** — fill in every checklist item
5. **Stay focused** — one logical change per PR when possible

### Review standards (for reviewers)

- CI is green
- Change matches the PR description
- No secrets, `.env.local`, or credentials in the diff
- Database migrations are small, named, and ordered under `supabase/migrations/`
- Auth, email, or RLS changes were considered for security impact
- New behavior has tests when practical (not required for pure UI tweaks)

Do not approve if you have not pulled the branch and spot-checked critical paths, or if CI is failing.

---

## Database and Supabase (one shared project)

Because dev and production share the same Supabase project:

1. **Never run experimental SQL** on the linked project during business hours without team agreement
2. **Add migrations** as new numbered files in `supabase/migrations/` — do not edit old migrations after merge
3. **Test migrations** locally or in the SQL Editor on a copy/backup when the change is destructive
4. **Document** seed or one-off data steps in the PR if reviewers must run something after deploy
5. **Back up** via Supabase dashboard before risky schema changes

---

## Secrets and environment

- **Never commit** `.env.local`, service-role keys, SMTP passwords, or deploy keys
- Use `.env.local` locally only (already gitignored)
- Production secrets live on the server / Secret Manager — not in the repo

---

## Deploying to production

Deploy is **manual** and **not automatic** on merge.

### GCE (current)

```bash
# On the deployer machine / VM — only after merged PR
./scripts/deploy-gce.sh
```

### Cloud Run

See [DEPLOY.md](./DEPLOY.md) — build image, then `gcloud run deploy`.

### Deploy checklist (deployer)

- [ ] PR merged to `feat/phase1-foundation`
- [ ] CI was green on the merged commit
- [ ] Team notified if the change needs a migration or config update
- [ ] Supabase Auth redirect URLs updated if the public URL changed
- [ ] Post-deploy smoke test: login, one critical page, invite/email if mail changed

---

## CI (GitHub Actions)

On every PR and push to `feat/phase1-foundation` / `main`:

| Step | Command |
|------|---------|
| Lint | `npm run lint` |
| Test | `npm run test` |
| Build | `npm run build` (placeholder public env vars) |

The required status check name for branch protection is: **`CI / ci`**

After the first CI workflow is merged, branch protection should require this check.
See [.github/BRANCH_PROTECTION.md](./.github/BRANCH_PROTECTION.md) for admin setup.

---

## Getting help

- Build or test failures: paste the CI log link in the PR
- Auth / Supabase issues: check Site URL and redirect URLs in Supabase dashboard
- Deploy issues: see [DEPLOY.md](./DEPLOY.md)

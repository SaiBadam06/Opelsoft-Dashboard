# Branch protection (admin one-time setup)

Branch protection cannot be fully enforced until the **CI workflow** exists on
`feat/phase1-foundation`. Merge the PR that adds `.github/workflows/ci.yml` first,
wait for one successful **CI / ci** run, then apply the settings below.

## GitHub UI (recommended)

Repository → **Settings** → **Branches** → **Add branch protection rule**

**Branch name pattern:** `feat/phase1-foundation`

Enable:

- [x] Require a pull request before merging
  - [x] Require approvals: **1**
  - [x] Dismiss stale pull request approvals when new commits are pushed
  - [x] Require review from Code Owners (optional — enable if you have multiple maintainers in CODEOWNERS)
- [x] Require status checks to pass before merging
  - [x] Require branches to be up to date before merging
  - Status check: **`CI / ci`**
- [x] Do not allow bypassing the above settings (including administrators)
- [x] Restrict pushes that create files larger than 100 MB (default)

Repeat for `main` when that branch becomes the release branch.

## GitHub CLI (alternative)

Replace `OWNER` with `snsettitech` (or your org).

**Step 1 — PR reviews only** (safe before CI exists):

```bash
gh api repos/OWNER/Opelsoft-Dashboard/branches/feat%2Fphase1-foundation/protection -X PUT \
  --input - <<'EOF'
{
  "required_status_checks": null,
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

**Step 2 — After first green CI run**, add the status check:

```bash
gh api repos/OWNER/Opelsoft-Dashboard/branches/feat%2Fphase1-foundation/protection -X PUT \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["CI / ci"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

## Verify

```bash
gh api repos/OWNER/Opelsoft-Dashboard/branches/feat%2Fphase1-foundation/protection
```

A direct push to `feat/phase1-foundation` should be rejected for non-bypass users.

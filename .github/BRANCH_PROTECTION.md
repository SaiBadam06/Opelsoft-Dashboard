# Branch protection (admin reference)

Protection applies to **`main`**.

## Current policy

| Rule | Setting |
|------|---------|
| Pull request required | Yes (employees) |
| Required approvals | 0 |
| CI check | `CI / ci` must pass |
| Enforce on admins | No — admins can bypass |
| Force push / delete | Blocked |

GitHub never allows **self-approval** on a PR. Admins merge their own PRs without an
approval step, or use admin bypass.

## GitHub CLI

```bash
gh api repos/snsettitech/Opelsoft-Dashboard/branches/main/protection -X PUT --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["CI / ci"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

## Verify

```bash
gh api repos/snsettitech/Opelsoft-Dashboard/branches/main/protection
```

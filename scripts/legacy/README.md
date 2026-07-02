# DEPRECATED — use Cloud Run instead

This script deployed to a GCE VM with PM2. **Production now uses Google Cloud Run.**

See [DEPLOY.md](../../DEPLOY.md) and [scripts/deploy-cloudrun.sh](../deploy-cloudrun.sh).

Shut down the GCE VM after migrating to Cloud Run to stop paying for it.

---

```bash
#!/usr/bin/env bash
# Legacy GCE deploy — do not use for new deployments.
set -euo pipefail

echo "ERROR: GCE deploy is deprecated. Use ./scripts/deploy-cloudrun.sh" >&2
echo "See DEPLOY.md" >&2
exit 1
```

The original script is preserved below for reference only.

---

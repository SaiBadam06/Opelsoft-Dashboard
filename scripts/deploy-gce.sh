#!/usr/bin/env bash
# DEPRECATED — production uses Google Cloud Run. See DEPLOY.md
set -euo pipefail
echo "ERROR: GCE deploy is deprecated. Use ./scripts/deploy-cloudrun.sh" >&2
echo "Legacy script: scripts/legacy/deploy-gce.sh" >&2
exit 1

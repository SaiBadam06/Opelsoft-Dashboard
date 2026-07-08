#!/usr/bin/env bash
# Deploy OpelSoft Dashboard to Google Cloud Run.
#
# Prerequisites (one-time): see DEPLOY.md — APIs, Artifact Registry, Secret Manager.
#
# Required env vars:
#   GCP_PROJECT_ID    — e.g. my-gcp-project
#   GCP_REGION        — e.g. us-central1
#   SITE_URL          — public Cloud Run URL (https://….run.app)
#   SUPABASE_URL      — NEXT_PUBLIC_SUPABASE_URL
#   SUPABASE_ANON_KEY — NEXT_PUBLIC_SUPABASE_ANON_KEY
#
# Optional:
#   IMAGE_TAG         — default: latest
#   SERVICE_NAME      — default: opelsoft-dashboard
#   SMTP_USER, SMTP_FROM

set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
: "${GCP_REGION:?Set GCP_REGION}"
: "${SITE_URL:?Set SITE_URL}"
: "${SUPABASE_URL:?Set SUPABASE_URL}"
: "${SUPABASE_ANON_KEY:?Set SUPABASE_ANON_KEY}"

IMAGE_TAG="${IMAGE_TAG:-latest}"
SERVICE_NAME="${SERVICE_NAME:-opelsoft-dashboard}"
IMAGE="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/opelsoft/${SERVICE_NAME}:${IMAGE_TAG}"
SMTP_USER="${SMTP_USER:-}"
SMTP_FROM="${SMTP_FROM:-$SMTP_USER}"

echo "==> Building and pushing image: ${IMAGE}"
gcloud builds submit --project "${GCP_PROJECT_ID}" --config cloudbuild.yaml \
  --substitutions="_IMAGE=${IMAGE},_SUPABASE_URL=${SUPABASE_URL},_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY},_SITE_URL=${SITE_URL}"

ENV_VARS="NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL},NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY},NEXT_PUBLIC_SITE_URL=${SITE_URL},SITE_URL=${SITE_URL},DEFAULT_CAREER_SITE_SLUG=${DEFAULT_CAREER_SITE_SLUG:-opelsoft}"
if [[ -n "${SMTP_USER}" ]]; then
  ENV_VARS="${ENV_VARS},SMTP_USER=${SMTP_USER}"
fi
if [[ -n "${SMTP_FROM}" ]]; then
  ENV_VARS="${ENV_VARS},SMTP_FROM=${SMTP_FROM}"
fi

echo "==> Deploying to Cloud Run: ${SERVICE_NAME}"
gcloud run deploy "${SERVICE_NAME}" \
  --project "${GCP_PROJECT_ID}" \
  --image "${IMAGE}" \
  --region "${GCP_REGION}" \
  --no-invoker-iam-check \
  --port 8080 \
  --memory 1Gi \
  --max-instances 3 \
  --set-env-vars "${ENV_VARS}" \
  --set-secrets "SUPABASE_SERVICE_ROLE_KEY=opelsoft-service-role:latest,SMTP_PASS=opelsoft-smtp-pass:latest,GEMINI_API_KEY=opelsoft-gemini-key:latest"

echo "==> Deployed. Service URL should match SITE_URL: ${SITE_URL}"
echo "    Verify Supabase Auth → URL Configuration uses this URL."

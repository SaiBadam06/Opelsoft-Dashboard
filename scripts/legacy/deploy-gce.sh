#!/usr/bin/env bash
# LEGACY — GCE VM + PM2 deploy (deprecated). See scripts/legacy/README.md
set -euo pipefail

APP_DIR="/opt/opelsoft-dashboard"
REPO_URL="git@github.com:snsettitech/Opelsoft-Dashboard.git"
BRANCH="main"
SITE_URL="${SITE_URL:-http://136.115.37.103:3000}"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/opelsoft_deploy}"
export GIT_SSH_COMMAND="ssh -i ${DEPLOY_KEY} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

export DEBIAN_FRONTEND=noninteractive

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs git
fi

sudo mkdir -p /opt
sudo chown -R "$USER:$USER" /opt

if [ ! -d "$APP_DIR/.git" ]; then
  git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$APP_DIR"
else
  cd "$APP_DIR"
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git reset --hard "origin/$BRANCH"
fi

cd "$APP_DIR"

cat > .env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
SEED_ADMIN_EMAIL=${SEED_ADMIN_EMAIL}
SEED_ADMIN_PASSWORD=${SEED_ADMIN_PASSWORD}
NEXT_PUBLIC_SITE_URL=${SITE_URL}
SITE_URL=${SITE_URL}
EOF

npm ci
npm run build

if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

pm2 delete opelsoft-dashboard 2>/dev/null || true
pm2 start npm --name opelsoft-dashboard -- start
pm2 save
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USER" --hp "$HOME" || true

echo "Deployed at ${SITE_URL}"

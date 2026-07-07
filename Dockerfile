# syntax=docker/dockerfile:1

# Debian slim (glibc) — matches GitHub Actions ubuntu-latest so npm ci + lockfile align.
# Alpine musl pulls different @tailwindcss/oxide optional bindings and breaks npm ci.

# ---- deps: install node_modules ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# npm ci fails when lockfile was generated on Windows (optional @emnapi/* mismatch).
# Use npm install in Docker; CI on ubuntu-latest still runs npm ci to catch drift.
RUN npm install --no-audit --no-fund

# ---- builder: compile the Next.js standalone bundle ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* are inlined into the browser bundle at build time, so they must
# be present here. These are public values (Supabase URL + publishable key); the
# service-role key and SMTP secrets are injected at runtime, never baked in.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---- runner: minimal production image ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# Cloud Run sends traffic to $PORT (defaults to 8080).
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
EXPOSE 8080

CMD ["node", "server.js"]

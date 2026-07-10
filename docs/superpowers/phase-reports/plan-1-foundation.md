# Plan 1 — Foundation: Completion Report

**Date:** 2026-06-26
**Branch:** `feat/phase1-foundation`
**Status:** ✅ Complete and verified (first slice of Phase 1)

## What was built

A secured Next.js + Supabase application you can log into, with the user/role
model and row-level security in place. This is the base every later module
(Consultants, Pipeline, Requirements, etc.) builds on.

- **App scaffold** at the repo root (moved out of the original `app-web/`
  subfolder per request): Next.js 16 (App Router) + TypeScript + Tailwind v4 +
  shadcn/ui.
- **Supabase auth** via `@supabase/ssr`: browser client, server client, and a
  `src/proxy.ts` session-refresh + route guard (Next.js 16 renamed the
  `middleware` convention to `proxy`).
- **Database:** `profiles` table mirroring `auth.users`, a `user_role` enum
  (`admin` | `coordinator`), a signup trigger that auto-creates a profile, an
  `is_admin()` helper, and RLS policies on `profiles`.
- **Auth flows:** email/password login, sign-out, and an admin "invite user by
  email + role" server action. Auth callback route for invite/confirm links.
- **App shell:** role-aware sidebar (hides admin-only nav from coordinators),
  topbar with current user + sign-out, authenticated route group `(app)`.
- **Admin Users page:** lists all users and sends invites.
- **Seed:** dummy admin account for testing.

## Files added (key ones)

- `src/lib/supabase/{client,server,proxy}.ts` — Supabase clients + session
- `src/proxy.ts` — route protection (redirect unauthenticated → `/login`)
- `src/lib/roles.ts` (+ `roles.test.ts`) — `Role`, `canAccess`, `NAV_ITEMS`
- `src/lib/auth.ts` — `getCurrentProfile`, `requireProfile`, `requireAdmin`
- `src/app/auth/actions.ts` — `signIn`, `signOut`, `inviteUser`
- `src/app/auth/callback/route.ts` — exchanges invite/confirm code for session
- `src/app/login/page.tsx` — login form
- `src/app/(app)/layout.tsx` — app shell; `(app)/dashboard/page.tsx` placeholder
- `src/app/(app)/users/{page,invite-form}.tsx` — admin users + invite
- `src/components/app-shell/{sidebar,topbar}.tsx`
- `supabase/migrations/0001_foundation.sql` — schema + RLS + trigger
- `supabase/verify_rls.sql` — RLS verification queries
- `scripts/seed.ts` — creates/promotes the dummy admin

## Supabase steps performed (by the user)

1. Created the Supabase project `opelsoft-dashboard`; shared Project URL + anon
   key + service-role key.
2. Ran `supabase/migrations/0001_foundation.sql` in the SQL Editor.
3. (Auth) Set Site URL `http://localhost:3000` and Redirect URL
   `http://localhost:3000/auth/callback` so invite emails work.
4. (Optional) Ran `supabase/verify_rls.sql` to confirm RLS + policies.

## Dummy admin credentials

- **Email:** `admin@opelsoft.test`
- **Password:** set locally in `.env.local` as `SEED_ADMIN_PASSWORD` (never committed)
- Defined in `.env.local` (`SEED_ADMIN_*`), which is gitignored. Re-runnable
  with `npm run seed` (idempotent).

## How to run

```bash
npm run dev      # start the app at http://localhost:3000
npm run seed     # (re)create the dummy admin
npm run test     # unit tests
npm run build    # production build
```

## Verification (all passed)

- `npm run test` → 4 passing
- `npx tsc --noEmit` → no errors
- `npm run build` → success; `ƒ Proxy (Middleware)` registered
- Live smoke test: `/` and `/dashboard` redirect unauthenticated users to
  `/login`; `/login` returns 200
- Seeded admin authenticates against Supabase (password grant returns a token)
- `profiles` row for the admin has `role = admin`

## Deferred to later plans (Phase 1 remainder)

- **Plan 2:** Consultant module + Jira pipeline board; admin reassignment of
  consultants; the "coordinators see only their own consultants" RLS.
- **Plan 3:** Requirements + Submissions + Vendors/Clients.
- **Plan 4:** Dashboard cards + Recent Activity + Excel importer. Phase 1
  completion report written after Plan 4.

## Notes / decisions during execution

- Next.js scaffolded as v16 (not 15). Honored its `AGENTS.md`: read the v16
  upgrade guide and used the new `proxy` convention (file at `src/proxy.ts`,
  same level as `app`, since the project uses a `src/` directory).
- App relocated from `app-web/` to the repo root at the user's request; package
  renamed to `opelsoft-dashboard`; seed script path updated to `./scripts`.

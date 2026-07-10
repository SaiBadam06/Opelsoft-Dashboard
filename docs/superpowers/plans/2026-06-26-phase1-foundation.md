# OpelSoft Dashboard — Plan 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a secured Next.js + Supabase app where an Admin can log in with a seeded account, the dashboard shell renders with role-aware navigation, and Supabase row-level security + the user/role model are in place — the foundation every later module builds on.

**Architecture:** Next.js (App Router, TypeScript) renders an authenticated app shell. Supabase provides Postgres, Auth, and Storage. Auth/session is handled with `@supabase/ssr` (browser client, server client, middleware). A `profiles` table mirrors `auth.users` and carries the `role` (`admin` | `coordinator`); a database trigger auto-creates a profile on signup. RLS protects `profiles`. A Node seed script (service-role) creates the dummy admin. Admins invite new users by email from a Users page.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, `@supabase/ssr`, `@supabase/supabase-js`, Vitest (unit tests), `tsx` (run TS scripts).

**Note on Supabase steps:** The user is new to Supabase. Every Supabase action below is click-by-click. Steps marked **[USER ACTION]** are performed by the user in the Supabase dashboard or a `.env` file; the agent pauses and waits for confirmation.

---

## File Structure

```
opelsoft-dashboard/
├── .env.local                         # Supabase keys (gitignored)
├── .env.example                       # template, committed
├── package.json
├── middleware.ts                      # session refresh + route protection
├── vitest.config.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # root layout (fonts, theme)
│   │   ├── globals.css
│   │   ├── page.tsx                   # redirects to /dashboard or /login
│   │   ├── login/page.tsx             # login form
│   │   ├── (app)/                     # authenticated route group
│   │   │   ├── layout.tsx             # app shell (sidebar + topbar)
│   │   │   ├── dashboard/page.tsx     # empty dashboard placeholder
│   │   │   └── users/page.tsx         # admin-only: list + invite users
│   │   └── auth/
│   │       ├── actions.ts             # signIn, signOut, inviteUser server actions
│   │       └── callback/route.ts      # handles invite/confirm redirects
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts              # browser client
│   │   │   ├── server.ts              # server client (RSC/actions)
│   │   │   └── middleware.ts          # session-refresh helper
│   │   ├── auth.ts                    # getCurrentProfile(), requireRole()
│   │   ├── roles.ts                   # Role type + nav permission helpers
│   │   └── nav.ts                     # sidebar nav config
│   ├── components/
│   │   ├── app-shell/sidebar.tsx
│   │   ├── app-shell/topbar.tsx
│   │   └── ui/                        # shadcn components (generated)
│   └── lib/roles.test.ts             # unit tests for role helpers
├── supabase/
│   ├── migrations/
│   │   └── 0001_foundation.sql        # profiles, role enum, trigger, RLS
│   └── verify_rls.sql                 # manual RLS verification queries
└── scripts/
    └── seed.ts                        # creates dummy admin via service role
```

---

## Task 1: Scaffold the Next.js app

**Files:**
- Create: entire `opelsoft-dashboard/` project via scaffolder

- [ ] **Step 1: Scaffold**

The repo root is `c:/Projects/Opelsoft Dashboard` (already a git repo containing `docs/`). Create the app in a subfolder named `app-web` to keep the project root clean.

Run (from `c:/Projects/Opelsoft Dashboard`):
```bash
npx create-next-app@latest app-web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm
```
Answer prompts: TypeScript **Yes**, ESLint **Yes**, Tailwind **Yes**, `src/` **Yes**, App Router **Yes**, import alias **@/***.

- [ ] **Step 2: Verify it runs**

Run:
```bash
cd app-web && npm run dev
```
Expected: dev server starts on `http://localhost:3000`, default Next.js page renders. Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
cd "c:/Projects/Opelsoft Dashboard"
git add -A && git commit -m "chore: scaffold next.js app (app-web)"
```

---

## Task 2: Install dependencies and init shadcn/ui

**Files:**
- Modify: `app-web/package.json`
- Create: `app-web/components.json`, `app-web/src/components/ui/*`

- [ ] **Step 1: Install runtime + dev deps**

Run (from `app-web/`):
```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest @vitejs/plugin-react jsdom tsx dotenv-cli
```

- [ ] **Step 2: Init shadcn/ui**

Run:
```bash
npx shadcn@latest init -d
```
Expected: creates `components.json`, `src/lib/utils.ts`, sets up CSS variables. Choose defaults (style: default, base color: Slate).

- [ ] **Step 3: Add the UI components we need now**

Run:
```bash
npx shadcn@latest add button input label card sonner avatar dropdown-menu separator badge
```
Expected: components appear under `src/components/ui/`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: add supabase, vitest, shadcn/ui"
```

---

## Task 3: Configure Vitest

**Files:**
- Create: `app-web/vitest.config.ts`
- Modify: `app-web/package.json` (scripts)

- [ ] **Step 1: Create `app-web/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 2: Add test script to `app-web/package.json`**

In the `"scripts"` block add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Verify Vitest runs (no tests yet)**

Run:
```bash
npm run test
```
Expected: Vitest reports "No test files found" (exit 0 is fine) — confirms config loads.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: configure vitest"
```

---

## Task 4: [USER ACTION] Create the Supabase project

> The agent pauses here and walks the user through these clicks, then waits for the keys.

- [ ] **Step 1: Create account + project**

1. Go to **https://supabase.com** → click **Start your project** → sign in with GitHub or email.
2. On the dashboard click **New project**.
3. **Organization:** pick or create one (any name, e.g. "OpelSoft").
4. **Name:** `opelsoft-dashboard`.
5. **Database Password:** click **Generate a password**, then **copy it and save it somewhere safe** (you'll rarely need it, but don't lose it).
6. **Region:** choose the one closest to your team (e.g. an East US region).
7. Click **Create new project**. Wait ~2 minutes for it to finish provisioning.

- [ ] **Step 2: Copy the three values the app needs**

1. In the left sidebar click the **gear icon (Project Settings)** → **API**.
2. Copy these and paste them to the agent:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (under "Project API keys" → the `anon` `public` row). *If your dashboard instead shows "Publishable key", copy that — it's the same role.*
   - **service_role** key (click the **reveal/eye** icon first). *If your dashboard shows "Secret keys" instead, create one and copy it.* **This key is secret — never put it in client code or commit it.**

- [ ] **Step 3: Confirm to the agent**

Reply with the three values. The agent will place them in `.env.local` (Task 5). Provisioning must show "Project is ready" before continuing.

---

## Task 5: Wire environment variables

**Files:**
- Create: `app-web/.env.local` (gitignored), `app-web/.env.example`
- Verify: `app-web/.gitignore` already ignores `.env*`

- [ ] **Step 1: Create `app-web/.env.example`** (committed template)

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SEED_ADMIN_EMAIL=admin@opelsoft.test
SEED_ADMIN_PASSWORD=
```

- [ ] **Step 2: Create `app-web/.env.local`** with the real values from Task 4

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
SEED_ADMIN_EMAIL=admin@opelsoft.test
SEED_ADMIN_PASSWORD=
```

- [ ] **Step 3: Confirm `.env.local` is gitignored**

Run:
```bash
git check-ignore app-web/.env.local
```
Expected: prints `app-web/.env.local` (meaning it IS ignored). If it prints nothing, add `.env*` to `app-web/.gitignore`.

- [ ] **Step 4: Commit the example only**

```bash
git add app-web/.env.example && git commit -m "chore: add env template"
```

---

## Task 6: Supabase client utilities

**Files:**
- Create: `app-web/src/lib/supabase/client.ts`, `server.ts`, `middleware.ts`

- [ ] **Step 1: Browser client — `src/lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 2: Server client — `src/lib/supabase/server.ts`**

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from a Server Component — safe to ignore; middleware refreshes
          }
        },
      },
    },
  );
}
```

- [ ] **Step 3: Middleware helper — `src/lib/supabase/middleware.ts`**

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = path === "/login" || path.startsWith("/auth");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: supabase client utilities"
```

---

## Task 7: Root middleware (route protection)

**Files:**
- Create: `app-web/middleware.ts`

- [ ] **Step 1: Create `app-web/middleware.ts`**

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 2: Verify app still builds**

Run:
```bash
npm run build
```
Expected: build succeeds (auth not yet exercised; redirect logic compiles).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: route-protection middleware"
```

---

## Task 8: Database migration — profiles, role enum, trigger, RLS

**Files:**
- Create: `supabase/migrations/0001_foundation.sql` (at repo root, not inside app-web)

- [ ] **Step 1: Write `supabase/migrations/0001_foundation.sql`**

```sql
-- Roles
create type public.user_role as enum ('admin', 'coordinator');

-- Profiles mirror auth.users
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'coordinator',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helper: is the current user an admin? (security definer avoids RLS recursion)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

-- Auto-create a profile when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;

-- Everyone authenticated can read their own profile
create policy "read own profile"
  on public.profiles for select
  using (id = auth.uid());

-- Admins can read all profiles
create policy "admin reads all profiles"
  on public.profiles for select
  using (public.is_admin());

-- Users can update their own non-role fields; admins can update anyone
create policy "update own profile"
  on public.profiles for update
  using (id = auth.uid());

create policy "admin updates any profile"
  on public.profiles for update
  using (public.is_admin());
```

- [ ] **Step 2: [USER ACTION] Run the migration in Supabase**

Walk the user through:
1. In the Supabase dashboard left sidebar, click **SQL Editor**.
2. Click **+ New query**.
3. Open `supabase/migrations/0001_foundation.sql`, copy ALL of it, paste into the editor.
4. Click **Run** (or press Ctrl/Cmd+Enter).
5. Expected: "Success. No rows returned." Confirm to the agent.

- [ ] **Step 3: Verify the table exists**

Tell the user: left sidebar → **Table Editor** → confirm a `profiles` table is listed with columns `id, email, full_name, role, is_active, created_at, updated_at`.

- [ ] **Step 4: Commit the migration**

```bash
git add supabase/migrations/0001_foundation.sql
git commit -m "feat(db): profiles, role enum, signup trigger, RLS"
```

---

## Task 9: Seed the dummy admin

**Files:**
- Create: `scripts/seed.ts` (repo root)

- [ ] **Step 1: Write `scripts/seed.ts`**

```typescript
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const email = process.env.SEED_ADMIN_EMAIL!;
const password = process.env.SEED_ADMIN_PASSWORD!;

if (!url || !serviceKey || !email || !password) {
  throw new Error("Missing env: SUPABASE URL/SERVICE_ROLE/SEED_ADMIN_* required");
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Create (or find) the admin auth user, email pre-confirmed
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "OpelSoft Admin" },
  });

  let userId = created?.user?.id;

  if (createErr) {
    if (!createErr.message.toLowerCase().includes("already")) throw createErr;
    // Already exists — look up the id
    const { data: list, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) throw listErr;
    userId = list.users.find((u) => u.email === email)?.id;
  }

  if (!userId) throw new Error("Could not resolve admin user id");

  // Promote to admin (trigger created the profile with default 'coordinator')
  const { error: roleErr } = await admin
    .from("profiles")
    .update({ role: "admin", full_name: "OpelSoft Admin", is_active: true })
    .eq("id", userId);
  if (roleErr) throw roleErr;

  console.log(`Seeded admin: ${email} (id ${userId})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Add a seed script to `app-web/package.json`**

In `"scripts"` add (the script reads env from `app-web/.env.local`):
```json
"seed": "dotenv -e .env.local -- tsx ../scripts/seed.ts"
```

- [ ] **Step 3: Run the seed**

Run (from `app-web/`):
```bash
npm run seed
```
Expected: prints `Seeded admin: admin@opelsoft.test (id ...)`.

- [ ] **Step 4: Verify in Supabase**

Tell the user: dashboard → **Authentication** → **Users** shows `admin@opelsoft.test`; **Table Editor → profiles** shows that row with `role = admin`.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed.ts app-web/package.json
git commit -m "feat: seed dummy admin account"
```

---

## Task 10: Role helpers (unit-tested)

**Files:**
- Create: `app-web/src/lib/roles.ts`, `app-web/src/lib/roles.test.ts`

- [ ] **Step 1: Write the failing test — `src/lib/roles.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { canAccess, NAV_ITEMS } from "@/lib/roles";

describe("canAccess", () => {
  it("lets admin access an admin-only item", () => {
    expect(canAccess("admin", "admin")).toBe(true);
  });
  it("blocks coordinator from an admin-only item", () => {
    expect(canAccess("coordinator", "admin")).toBe(false);
  });
  it("lets both roles access a shared item", () => {
    expect(canAccess("coordinator", "any")).toBe(true);
    expect(canAccess("admin", "any")).toBe(true);
  });
});

describe("NAV_ITEMS", () => {
  it("includes a Users item restricted to admin", () => {
    const users = NAV_ITEMS.find((i) => i.href === "/users");
    expect(users?.minRole).toBe("admin");
  });
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `npm run test`
Expected: FAIL — `@/lib/roles` not found.

- [ ] **Step 3: Implement `src/lib/roles.ts`**

```typescript
export type Role = "admin" | "coordinator";
export type Access = "admin" | "any";

export function canAccess(role: Role, required: Access): boolean {
  if (required === "any") return true;
  return role === "admin";
}

export interface NavItem {
  label: string;
  href: string;
  minRole: Access;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", minRole: "any" },
  { label: "Consultants", href: "/consultants", minRole: "any" },
  { label: "Pipeline", href: "/pipeline", minRole: "any" },
  { label: "Requirements", href: "/requirements", minRole: "any" },
  { label: "Submissions", href: "/submissions", minRole: "any" },
  { label: "Interviews", href: "/interviews", minRole: "any" },
  { label: "Placements", href: "/placements", minRole: "any" },
  { label: "Vendors & Clients", href: "/vendors", minRole: "any" },
  { label: "Tasks", href: "/tasks", minRole: "any" },
  { label: "Users", href: "/users", minRole: "admin" },
];
```

- [ ] **Step 4: Run it — expect pass**

Run: `npm run test`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: role helpers + nav config (tested)"
```

---

## Task 11: Auth helpers (current profile + role guard)

**Files:**
- Create: `app-web/src/lib/auth.ts`

- [ ] **Step 1: Write `src/lib/auth.ts`**

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/roles";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  is_active: boolean;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/dashboard");
  return profile;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: auth helpers (getCurrentProfile, requireAdmin)"
```

---

## Task 12: Auth server actions + callback route

**Files:**
- Create: `app-web/src/app/auth/actions.ts`, `app-web/src/app/auth/callback/route.ts`

- [ ] **Step 1: Write `src/app/auth/actions.ts`**

```typescript
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/lib/auth";

export async function signIn(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function inviteUser(_prev: unknown, formData: FormData) {
  const me = await getCurrentProfile();
  if (me?.role !== "admin") return { error: "Not authorized" };

  const email = String(formData.get("email") ?? "");
  const role = String(formData.get("role") ?? "coordinator");
  if (role !== "admin" && role !== "coordinator") {
    return { error: "Invalid role" };
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });
  if (error) return { error: error.message };

  // Set the chosen role on the freshly created profile
  if (data.user) {
    await admin.from("profiles").update({ role }).eq("id", data.user.id);
  }
  return { ok: true };
}
```

- [ ] **Step 2: Add `NEXT_PUBLIC_SITE_URL` to env files**

Add to `app-web/.env.local` and `.env.example`:
```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 3: Write `src/app/auth/callback/route.ts`**

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${origin}/dashboard`);
}
```

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit` (expect no errors)
```bash
git add -A && git commit -m "feat: auth actions (signIn, signOut, inviteUser) + callback"
```

---

## Task 13: Login page

**Files:**
- Create: `app-web/src/app/login/page.tsx`
- Replace: `app-web/src/app/page.tsx`

- [ ] **Step 1: Write `src/app/login/page.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { signIn } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">OpelSoft Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {state?.error && (
              <p className="text-sm text-red-600">{state.error}</p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 2: Replace `src/app/page.tsx`** (root redirect)

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

- [ ] **Step 3: Verify login works end-to-end**

Run: `npm run dev`, open `http://localhost:3000`.
Expected: redirected to `/login`. Sign in with the seeded admin credentials from `.env.local` → lands on `/dashboard` (placeholder created next task; until then a 404 is acceptable — the redirect itself proves auth works). Confirm the session cookie is set and re-visiting `/login` bounces to `/dashboard`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: login page + root redirect"
```

---

## Task 14: App shell (sidebar + topbar) and authenticated layout

**Files:**
- Create: `app-web/src/components/app-shell/sidebar.tsx`, `topbar.tsx`
- Create: `app-web/src/app/(app)/layout.tsx`, `app-web/src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Sidebar — `src/components/app-shell/sidebar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, canAccess, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => canAccess(role, i.minRole));

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-background md:block">
      <div className="px-5 py-4 text-lg font-semibold">OpelSoft</div>
      <nav className="flex flex-col gap-1 px-2">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                active && "bg-muted font-medium text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Topbar — `src/components/app-shell/topbar.tsx`**

```tsx
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/lib/auth";

export function Topbar({ profile }: { profile: Profile }) {
  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <div className="text-sm text-muted-foreground">
        Signed in as{" "}
        <span className="font-medium text-foreground">
          {profile.full_name ?? profile.email}
        </span>{" "}
        ({profile.role})
      </div>
      <form action={signOut}>
        <Button type="submit" variant="outline" size="sm">
          Sign out
        </Button>
      </form>
    </header>
  );
}
```

- [ ] **Step 3: Authenticated layout — `src/app/(app)/layout.tsx`**

```tsx
import { requireProfile } from "@/lib/auth";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  return (
    <div className="flex min-h-screen">
      <Sidebar role={profile.role} />
      <div className="flex flex-1 flex-col">
        <Topbar profile={profile} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Dashboard placeholder — `src/app/(app)/dashboard/page.tsx`**

```tsx
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Metrics and activity will appear here (Plan 4).
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Verify the shell**

Run: `npm run dev`, sign in.
Expected: `/dashboard` renders inside the shell; sidebar shows all nav items **including "Users"** (admin). Sign out returns to `/login`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: app shell (sidebar, topbar, authenticated layout)"
```

---

## Task 15: Users page (admin-only) + invite form

**Files:**
- Create: `app-web/src/app/(app)/users/page.tsx`
- Create: `app-web/src/app/(app)/users/invite-form.tsx`

- [ ] **Step 1: Invite form — `src/app/(app)/users/invite-form.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { inviteUser } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteUser, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required className="w-64" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          name="role"
          className="h-9 rounded-md border bg-background px-3 text-sm"
          defaultValue="coordinator"
        >
          <option value="coordinator">Coordinator</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Inviting…" : "Send invite"}
      </Button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-600">Invite sent.</p>}
    </form>
  );
}
```

- [ ] **Step 2: Users page — `src/app/(app)/users/page.tsx`**

```tsx
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./invite-form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function UsersPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Users</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite a user</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All users</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-2">{u.full_name ?? "—"}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.is_active ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: [USER ACTION] Configure Supabase email redirect URL**

So invite links work, tell the user:
1. Supabase dashboard → **Authentication** → **URL Configuration**.
2. Set **Site URL** to `http://localhost:3000` (for now).
3. Under **Redirect URLs** add `http://localhost:3000/auth/callback`.
4. Click **Save**.

- [ ] **Step 4: Verify**

Run `npm run dev`, sign in as admin → open **Users**.
Expected: the admin row is listed. Submitting the invite form with a real email you control shows "Invite sent." and a new row appears (role as chosen). *(Email delivery uses Supabase's built-in mailer, which is rate-limited; for heavy use a custom SMTP is configured later.)*

Also verify a coordinator cannot reach this page: there's no coordinator account yet, so this is re-checked in Plan 2 once one exists. For now, confirm `requireAdmin()` compiles and admins get through.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: admin users page + invite form"
```

---

## Task 16: RLS verification script (security check)

**Files:**
- Create: `supabase/verify_rls.sql`

- [ ] **Step 1: Write `supabase/verify_rls.sql`**

```sql
-- Run in Supabase SQL Editor to confirm RLS is enabled and policies exist.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename = 'profiles';
-- Expect: rowsecurity = true

select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'profiles'
order by policyname;
-- Expect: read own profile (SELECT), admin reads all profiles (SELECT),
--         update own profile (UPDATE), admin updates any profile (UPDATE)
```

- [ ] **Step 2: [USER ACTION] Run it**

Tell the user: SQL Editor → new query → paste → Run. Confirm `rowsecurity = true` and all four policies are listed.

- [ ] **Step 3: Commit**

```bash
git add supabase/verify_rls.sql
git commit -m "chore(db): RLS verification script"
```

---

## Task 17: Phase-aligned wrap-up (foundation report)

> This plan is the first slice of Phase 1; the full Phase-1 completion report is written after Plan 4. This task records foundation status so later plans have a baseline.

**Files:**
- Create: `docs/superpowers/phase-reports/plan-1-foundation.md`

- [ ] **Step 1: Write `docs/superpowers/phase-reports/plan-1-foundation.md`**

Document, concretely: what was built (auth, profiles, RLS, shell, seed, invites), the dummy admin credentials location (`.env.local`), exact files added, the Supabase steps the user performed, how to run (`npm run dev`, `npm run seed`, `npm run test`), and what's deferred to Plans 2–4. (Write real content, not placeholders.)

- [ ] **Step 2: Final verification pass**

Run all of:
```bash
cd app-web
npm run test      # role helper tests pass
npx tsc --noEmit  # no type errors
npm run build     # production build succeeds
```
Expected: all green.

- [ ] **Step 3: Commit**

```bash
cd "c:/Projects/Opelsoft Dashboard"
git add -A && git commit -m "docs: plan-1 foundation report"
```

---

## Self-Review Notes

- **Spec coverage (foundation slice):** Stack (Next.js + Supabase + shadcn) ✓; Auth email-invite + roles ✓ (Task 12, 15); seeded dummy admin ✓ (Task 9); RLS pattern + `is_admin()` helper ✓ (Task 8); role-aware shell ✓ (Task 14); admin reassignment / consultant RLS / modules / importer / charts are **intentionally deferred** to Plans 2–4 (they need the `consultants` and related tables those plans own).
- **Type consistency:** `Role` ("admin"|"coordinator") defined in `roles.ts`, reused in `auth.ts`, `sidebar.tsx`, actions. `Profile` defined in `auth.ts`, reused in `topbar.tsx`, users page. `canAccess`/`NAV_ITEMS` names consistent across `roles.ts`, `roles.test.ts`, `sidebar.tsx`.
- **No placeholders:** every code step contains complete code; the only "fill in" is Task 17's report, which is descriptive prose the engineer writes from concrete facts.
- **Supabase hand-holding:** Tasks 4, 8, 15, 16 contain click-by-click [USER ACTION] steps per the user's requirement.

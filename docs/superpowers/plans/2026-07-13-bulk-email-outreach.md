# Bulk Email Outreach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a dashboard-native bulk-email feature (compose → pick recipients → spam-check → throttled compliant send → per-recipient log) on Microsoft Graph, behind a swappable sender.

**Architecture:** Server Actions + a secret-protected `/api/campaigns/drain` route worked every minute by Supabase `pg_cron`. A durable Postgres queue (`email_campaign_recipients`) holds per-recipient state; the drain claims batches with `FOR UPDATE SKIP LOCKED`, sends ≤28/min via a `GraphSender` (client-credentials token), honors a daily cap + suppression list, and retries `429/5xx`. One-click unsubscribe + CAN-SPAM footer on every mail. Sender is one interface → ACS swap later.

**Tech Stack:** Next.js 16.2.9 (App Router, Server Actions), React 19, TypeScript, `@supabase/supabase-js` + `@supabase/ssr`, `xlsx`, vitest, shadcn/Tailwind v4, Microsoft Graph REST.

**Spec:** `docs/superpowers/specs/2026-07-13-bulk-email-outreach-design.md`

**Conventions to follow (from this codebase):**
- Migrations: `supabase/migrations/NNNN_name.sql`; enums via `create type`; `set_updated_at()` trigger; `is_admin()`; RLS "shared workspace" policies (authenticated read/write/update, admin delete); trigger fns are `security definer set search_path = public`. **Next number is `0017`.**
- Server client (RLS, user session): `import { createClient } from "@/lib/supabase/server"`.
- Current profile: `import { getCurrentProfile } from "@/lib/auth"`.
- Server actions live in `src/app/(app)/<feature>/actions.ts`, start with `"use server"`, use `revalidatePath` / `redirect`, return `{ error }` or `{ ok: true }`.
- Data helpers live in `src/lib/<feature>.ts` (interface + `COLUMNS` const + functions).
- Email regex already used in repo: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.

> **COMMITS ARE GATED.** Project rule: never `git commit`/`push` without the user's explicit go-ahead. Each task ends with a commit *step*, but the executor must ASK before running it (or batch-confirm with the user). Do not push.

> **NEXT 16 IS NOT YOUR TRAINING DATA.** Per `AGENTS.md`, before writing any route handler / server action / page, skim the relevant guide under `node_modules/next/dist/docs/`. Notably: `params` and `searchParams` in pages are **Promises** (await them); `cookies()` is async.

---

## Phase 0 — Safety & external setup (no app code)

### Task 0.1: Secure secrets before anything else

**Files:**
- Verify/Modify: `.gitignore`
- Create: `.env.example`
- Inspect: `.env.local` (do NOT print its values into any committed file)

- [ ] **Step 1: Confirm `.env.local` is gitignored and not tracked**

Run:
```bash
git check-ignore .env.local && echo "IGNORED (good)" || echo "NOT IGNORED"
git ls-files --error-unmatch .env.local 2>/dev/null && echo "TRACKED (BAD)" || echo "not tracked (good)"
```
Expected: `IGNORED (good)` and `not tracked (good)`.

- [ ] **Step 2: If tracked, untrack it (keep the file on disk)**

Only if Step 1 said `TRACKED (BAD)`:
```bash
git rm --cached .env.local
echo ".env.local" >> .gitignore
```
Then tell the user: any secret that was ever committed (SMTP pass, Supabase service-role key) is considered exposed — **rotate it**. List which keys were present (names only) so they know what to rotate.

- [ ] **Step 3: Create `.env.example` with key names only (no values)**

```dotenv
# Supabase (existing)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=

# Bulk email — Microsoft Graph (new)
MS_TENANT_ID=
MS_CLIENT_ID=
MS_CLIENT_SECRET=
EMAIL_SENDER_ADDRESSES=alex.smith@opelsoft.com
EMAIL_DEFAULT_REPLY_TO=harsh@opelsoft.com
EMAIL_DAILY_CAP=800
EMAIL_SENDER_BACKEND=graph
EMAIL_DRAIN_SECRET=
APP_BASE_URL=
```

- [ ] **Step 4: Commit** (ASK FIRST)

```bash
git add .gitignore .env.example
git commit -m "chore(email): add .env.example and secure .env.local"
```

---

### Task 0.2: Azure / M365 setup (user does this in the portal — checklist)

No code. Walk the user through, one click at a time. Nothing else works until this is done.

- [ ] **Step 1: Grant the app permission**
  Azure Portal → **Microsoft Entra ID** → **App registrations** → your registered app → **API permissions** → **Add a permission** → **Microsoft Graph** → **Application permissions** → search **`Mail.Send`** → check it → **Add**. Then **Grant admin consent for <tenant>** (button at top). Status must show a green check.
  While here: remove any broad permissions you granted earlier that aren't needed (e.g. `Mail.ReadWrite`, `User.Read.All`) — least privilege.

- [ ] **Step 2: Scope the app to one mailbox (Application Access Policy)**
  In **Exchange Online PowerShell** (Connect-ExchangeOnline), run:
```powershell
New-ApplicationAccessPolicy -AppId <MS_CLIENT_ID> `
  -PolicyScopeGroupId <security-group-containing-alex.smith@opelsoft.com> `
  -AccessRight RestrictAccess `
  -Description "Bulk email app may only send as approved mailboxes"
Test-ApplicationAccessPolicy -AppId <MS_CLIENT_ID> -Identity alex.smith@opelsoft.com   # AccessCheckResult: Granted
Test-ApplicationAccessPolicy -AppId <MS_CLIENT_ID> -Identity someone.else@opelsoft.com # AccessCheckResult: Denied
```
Create a mail-enabled security group first if needed and put the allowed sender(s) in it. Without this policy the app can send as **anyone** in the tenant.

- [ ] **Step 3: Create a client secret**
  App registration → **Certificates & secrets** → **New client secret** → copy the **Value** immediately (shown once).

- [ ] **Step 4: Collect the three IDs** — Tenant ID + Application (client) ID (Overview page) + the secret Value.

---

### Task 0.3: Put the config into `.env.local`

**Files:** Modify `.env.local` (untracked).

- [ ] **Step 1: Add the keys** (real values, local only)

```dotenv
MS_TENANT_ID=<tenant id>
MS_CLIENT_ID=<client id>
MS_CLIENT_SECRET=<secret value>
EMAIL_SENDER_ADDRESSES=alex.smith@opelsoft.com
EMAIL_DEFAULT_REPLY_TO=harsh@opelsoft.com
EMAIL_DAILY_CAP=800
EMAIL_SENDER_BACKEND=graph
EMAIL_DRAIN_SECRET=<paste output of: openssl rand -hex 32>
APP_BASE_URL=https://<your-cloud-run-url>   # local dev: http://localhost:3000
```

- [ ] **Step 2: Generate the drain secret**

Run: `openssl rand -hex 32` → paste into `EMAIL_DRAIN_SECRET`. No commit (untracked file).

---

### Task 0.4: Verify DNS deliverability (user — checklist, do before first real send)

No code. Confirm before any real recipient gets mail.

- [ ] **Step 1: Check the three records**
```powershell
Resolve-DnsName -Type TXT   opelsoft.com                      # SPF: v=spf1 ... include:spf.protection.outlook.com -all
Resolve-DnsName -Type CNAME selector1._domainkey.opelsoft.com # DKIM: resolves to ...onmicrosoft.com
Resolve-DnsName -Type TXT   _dmarc.opelsoft.com               # DMARC: v=DMARC1; p=...
```
- [ ] **Step 2: Enable DKIM if missing** — Microsoft **Defender portal** → Email & collaboration → Policies → **Email authentication settings** → **DKIM** → opelsoft.com → **Enable**.
- [ ] **Step 3: Ground-truth test** — from `alex.smith@opelsoft.com`, send one email to a Gmail address → open → **⋮ → Show original** → confirm **SPF/DKIM/DMARC = PASS**. Do not proceed to real sends until all three PASS.

---

## Phase 1 — Database

### Task 1.1: Migration — campaign tables, RPCs, RLS

**Files:**
- Create: `supabase/migrations/0017_email_campaigns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0017_email_campaigns.sql — bulk email outreach: campaigns, recipients (send log), suppressions

create type public.email_campaign_status as enum ('draft','sending','paused','done','failed');
create type public.email_recipient_status as enum ('queued','sending','sent','failed','suppressed');
create type public.email_suppression_reason as enum ('unsubscribe','bounce','complaint','manual');

-- Campaigns
create table public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  body_html text not null,
  from_address text not null,
  reply_to text,
  status public.email_campaign_status not null default 'draft',
  total int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger email_campaigns_set_updated_at before update on public.email_campaigns
  for each row execute function public.set_updated_at();

-- Recipients = the send log
create table public.email_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete set null,
  email text not null,
  merge_data jsonb not null default '{}'::jsonb,
  status public.email_recipient_status not null default 'queued',
  attempts int not null default 0,
  last_error text,
  message_id text,
  unsubscribe_token uuid not null default gen_random_uuid(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, email)
);
create unique index email_recipients_token_idx on public.email_campaign_recipients(unsubscribe_token);
create index email_recipients_drain_idx on public.email_campaign_recipients(campaign_id, status, created_at);
create index email_recipients_sent_idx on public.email_campaign_recipients(sent_at) where status = 'sent';
create trigger email_recipients_set_updated_at before update on public.email_campaign_recipients
  for each row execute function public.set_updated_at();

-- Suppression list (never email these)
create table public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  reason public.email_suppression_reason not null,
  source_campaign_id uuid references public.email_campaigns(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index email_suppressions_email_idx on public.email_suppressions(lower(email));

-- Atomically claim a batch of queued recipients (safe across overlapping drain ticks)
create or replace function public.claim_email_batch(p_campaign uuid, p_limit int)
returns setof public.email_campaign_recipients
language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.email_campaign_recipients r
  set status = 'sending', attempts = r.attempts + 1
  where r.id in (
    select id from public.email_campaign_recipients
    where campaign_id = p_campaign and status = 'queued'
    order by created_at
    for update skip locked
    limit p_limit
  )
  returning r.*;
end;
$$;

-- Count 'sent' in trailing 24h for a from_address (daily-cap guard)
create or replace function public.email_sent_last_24h(p_from text)
returns int language sql security definer set search_path = public as $$
  select count(*)::int
  from public.email_campaign_recipients r
  join public.email_campaigns c on c.id = r.campaign_id
  where c.from_address = p_from and r.status = 'sent'
    and r.sent_at > now() - interval '24 hours';
$$;

-- RLS: shared workspace (authenticated read/write/update; admin delete). Service role bypasses RLS for the drain.
alter table public.email_campaigns enable row level security;
alter table public.email_campaign_recipients enable row level security;
alter table public.email_suppressions enable row level security;

create policy "email_campaigns_read"   on public.email_campaigns for select to authenticated using (true);
create policy "email_campaigns_write"  on public.email_campaigns for insert to authenticated with check (true);
create policy "email_campaigns_update" on public.email_campaigns for update to authenticated using (true);
create policy "email_campaigns_delete" on public.email_campaigns for delete to authenticated using (public.is_admin());

create policy "email_recipients_read"  on public.email_campaign_recipients for select to authenticated using (true);
create policy "email_recipients_write" on public.email_campaign_recipients for insert to authenticated with check (true);
create policy "email_recipients_update" on public.email_campaign_recipients for update to authenticated using (true);

create policy "email_suppressions_read"  on public.email_suppressions for select to authenticated using (true);
create policy "email_suppressions_write" on public.email_suppressions for insert to authenticated with check (true);
create policy "email_suppressions_delete" on public.email_suppressions for delete to authenticated using (public.is_admin());
```

- [ ] **Step 2: Apply the migration**

Run it against your Supabase project (SQL editor → paste → Run, or your migration tool). Then verify:
```sql
select count(*) from public.email_campaigns;          -- 0
select public.email_sent_last_24h('alex.smith@opelsoft.com'); -- 0
```
Expected: both return 0 (tables + functions exist).

- [ ] **Step 3: Commit** (ASK FIRST)
```bash
git add supabase/migrations/0017_email_campaigns.sql
git commit -m "feat(email): campaign/recipient/suppression tables + claim/cap RPCs"
```

---

## Phase 2 — Email core library (TDD)

### Task 2.1: Types + sender interface

**Files:** Create `src/lib/email/types.ts`

- [ ] **Step 1: Write it**
```ts
export type OutboundEmail = {
  from: string;
  replyTo?: string;
  to: string;
  subject: string;
  html: string;
  /** Header name → value. List-* headers are delivered via Graph extended properties. */
  headers?: Record<string, string>;
};

export interface EmailSender {
  /** Sends one message. Resolves with a provider id, or throws (err.status carries any HTTP code). */
  send(msg: OutboundEmail): Promise<{ id: string }>;
}
```
- [ ] **Step 2: Commit** (ASK FIRST) — `git add src/lib/email/types.ts && git commit -m "feat(email): sender types"`

---

### Task 2.2: Rendering — merge fields, footer, unsubscribe

**Files:** Create `src/lib/email/render.ts`, `src/lib/email/render.test.ts`

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it, expect } from "vitest";
import { applyMergeFields, unsubscribeUrl, buildOutbound } from "./render";

describe("applyMergeFields", () => {
  it("replaces known fields and blanks unknown/empty", () => {
    expect(applyMergeFields("Dear {{contact_name}}", { contact_name: "Sam" })).toBe("Dear Sam");
    expect(applyMergeFields("Dear {{contact_name}}", {})).toBe("Dear ");
  });
});

describe("buildOutbound", () => {
  it("merges, appends footer with address + unsubscribe, and sets List-* headers", () => {
    const url = unsubscribeUrl("https://app.test/", "tok123");
    const msg = buildOutbound({
      from: "a@opelsoft.com", replyTo: "h@opelsoft.com", to: "v@x.com",
      subject: "Hi {{contact_name}}", bodyTemplate: "<p>Hello {{contact_name}}</p>",
      mergeData: { contact_name: "Sam" }, unsubUrl: url,
    });
    expect(msg.subject).toBe("Hi Sam");
    expect(msg.html).toContain("Hello Sam");
    expect(msg.html).toContain("Piscataway");
    expect(msg.html).toContain(url);
    expect(msg.headers?.["List-Unsubscribe"]).toBe(`<${url}>`);
    expect(msg.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});
```
- [ ] **Step 2: Run — expect FAIL** — `npm test -- render` → "Cannot find module './render'".
- [ ] **Step 3: Implement**
```ts
import type { OutboundEmail } from "./types";

const ADDRESS = "OpelSoft LLC, 255 Old New Brunswick Road, Suite N210, Piscataway, NJ 08854";

export function applyMergeFields(
  template: string,
  data: Record<string, string | null | undefined>,
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => {
    const v = data[key];
    return v == null ? "" : String(v);
  });
}

export function unsubscribeUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/api/unsubscribe?token=${token}`;
}

export function withFooter(bodyHtml: string, unsubUrl: string): string {
  const footer = `
<hr style="border:none;border-top:1px solid #ddd;margin-top:20px">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#777;margin-top:8px">
  ${ADDRESS}<br>
  You're receiving this as a vendor contact of OpelSoft.
  <a href="${unsubUrl}">Unsubscribe</a>.
</div>`;
  return `${bodyHtml}\n${footer}`;
}

export function buildOutbound(opts: {
  from: string;
  replyTo?: string;
  to: string;
  subject: string;
  bodyTemplate: string;
  mergeData: Record<string, string | null | undefined>;
  unsubUrl: string;
}): OutboundEmail {
  const html = withFooter(applyMergeFields(opts.bodyTemplate, opts.mergeData), opts.unsubUrl);
  return {
    from: opts.from,
    replyTo: opts.replyTo,
    to: opts.to,
    subject: applyMergeFields(opts.subject, opts.mergeData),
    html,
    headers: {
      "List-Unsubscribe": `<${opts.unsubUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
```
- [ ] **Step 4: Run — expect PASS** — `npm test -- render`.
- [ ] **Step 5: Commit** (ASK FIRST) — `git add src/lib/email/render.* && git commit -m "feat(email): merge + footer + unsubscribe rendering"`

---

### Task 2.3: Spam linter

**Files:** Create `src/lib/email/spamCheck.ts`, `src/lib/email/spamCheck.test.ts`

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it, expect } from "vitest";
import { spamCheck } from "./spamCheck";

const rules = (s: ReturnType<typeof spamCheck>) => s.warnings.map((w) => w.rule);

describe("spamCheck", () => {
  it("flags trigger words, empty subject, url shorteners", () => {
    const r = spamCheck({ subject: "", html: "<p>Act now, it's FREE — http://bit.ly/x</p>" });
    expect(rules(r)).toEqual(expect.arrayContaining(["empty-subject", "trigger-word", "shortener"]));
    expect(r.score).toBeGreaterThan(0);
  });
  it("flags red text and missing alt on images", () => {
    const r = spamCheck({ subject: "Requirements", html: '<p style="color:#C82613">hi</p><img src="x">' });
    expect(rules(r)).toEqual(expect.arrayContaining(["red-text", "img-alt"]));
  });
  it("is quiet for a clean business email", () => {
    const r = spamCheck({ subject: "Sharing a requirement", html: "<p>We have consultants available across .NET and Java. Reply to discuss details and rates for your open roles. Thanks.</p>" });
    expect(r.warnings.filter((w) => w.severity === "high")).toHaveLength(0);
  });
});
```
- [ ] **Step 2: Run — expect FAIL**.
- [ ] **Step 3: Implement**
```ts
export type SpamWarning = { rule: string; message: string; severity: "low" | "high" };
export type SpamResult = { score: number; warnings: SpamWarning[] };

const TRIGGER_WORDS = [
  "free", "guarantee", "act now", "limited time", "urgent", "risk-free", "100%",
  "click here", "winner", "cash", "$$$", "earn money", "no cost", "cheap", "order now",
  "buy now", "double your", "extra income",
];

export function spamCheck(input: { subject: string; html: string }): SpamResult {
  const warnings: SpamWarning[] = [];
  const subject = input.subject ?? "";
  const html = input.html ?? "";
  const text = html.replace(/<[^>]+>/g, " ");
  const hay = `${subject} ${text}`.toLowerCase();
  const add = (rule: string, message: string, severity: "low" | "high") =>
    warnings.push({ rule, message, severity });

  for (const w of TRIGGER_WORDS) if (hay.includes(w)) add("trigger-word", `Spammy phrase: "${w}"`, "high");
  if (!subject.trim()) add("empty-subject", "Subject is empty", "high");
  if (subject.length > 90) add("long-subject", "Subject is very long (>90 chars)", "low");
  if (/!!!/.test(hay) || (hay.match(/!/g)?.length ?? 0) > 3) add("exclamation", "Too many exclamation marks", "low");
  if ((subject.match(/\b[A-Z]{4,}\b/g) ?? []).length > 0) add("all-caps", "ALL-CAPS word(s) in subject", "low");

  const links = (html.match(/<a\s/gi) ?? []).length;
  if (links > 5) add("many-links", `${links} links — keep cold outreach lean`, "low");
  if (/\b(bit\.ly|tinyurl|goo\.gl|t\.co)\b/i.test(html)) add("shortener", "URL shortener detected", "high");

  const imgs = (html.match(/<img\s/gi) ?? []).length;
  const textLen = text.replace(/\s+/g, " ").trim().length;
  if (imgs > 0 && textLen < 200) add("image-heavy", "Very little text relative to images", "high");
  if (/<img\s(?![^>]*\balt\s*=)[^>]*>/i.test(html)) add("img-alt", "Image missing alt text", "low");
  if (/color\s*:\s*(#c8[0-9a-f]{4}|#ff0000|red)\b/i.test(html)) add("red-text", "Red-colored text is a spam signal", "low");
  if (!/unsubscribe/i.test(html)) add("no-unsub-in-body", "No unsubscribe in body (auto-added at send)", "low");

  const score = warnings.reduce((s, w) => s + (w.severity === "high" ? 25 : 8), 0);
  return { score, warnings };
}
```
- [ ] **Step 4: Run — expect PASS**.
- [ ] **Step 5: Commit** (ASK FIRST) — `git add src/lib/email/spamCheck.* && git commit -m "feat(email): rules-based spam linter"`

---

### Task 2.4: Recipient parsing / validation / dedupe

**Files:** Create `src/lib/email/recipients.ts`, `src/lib/email/recipients.test.ts`

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseManualList, dedupe, validate, parseSpreadsheet, normalizeEmail } from "./recipients";

describe("recipients", () => {
  it("parseManualList splits on commas, spaces and newlines", () => {
    expect(parseManualList("a@x.com, b@y.com\n c@z.com").map((r) => r.email))
      .toEqual(["a@x.com", "b@y.com", "c@z.com"]);
  });
  it("dedupe is case-insensitive, keeps first", () => {
    const out = dedupe([{ email: "A@x.com", mergeData: {} }, { email: "a@x.com", mergeData: {} }]);
    expect(out).toHaveLength(1);
    expect(out[0].email).toBe("a@x.com");
  });
  it("validate separates good from bad", () => {
    const { valid, invalid } = validate([{ email: "ok@x.com", mergeData: {} }, { email: "nope", mergeData: {} }]);
    expect(valid.map((v) => v.email)).toEqual(["ok@x.com"]);
    expect(invalid).toEqual(["nope"]);
  });
  it("parseSpreadsheet finds the email column and keeps other cols as merge data", () => {
    const ws = XLSX.utils.aoa_to_sheet([["Email", "Contact Name"], ["v@x.com", "Sam"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const rows = parseSpreadsheet(buf);
    expect(rows[0].email).toBe(normalizeEmail("v@x.com"));
    expect(rows[0].mergeData["contact name"]).toBe("Sam");
  });
});
```
- [ ] **Step 2: Run — expect FAIL**.
- [ ] **Step 3: Implement**
```ts
import * as XLSX from "xlsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ParsedRecipient = { email: string; mergeData: Record<string, string> };

export function normalizeEmail(e: string): string {
  return e.trim().toLowerCase();
}
export function isValidEmail(e: string): boolean {
  return EMAIL_RE.test(e.trim());
}
export function parseManualList(raw: string): ParsedRecipient[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((email) => ({ email: normalizeEmail(email), mergeData: {} }));
}
export function dedupe(list: ParsedRecipient[]): ParsedRecipient[] {
  const seen = new Set<string>();
  const out: ParsedRecipient[] = [];
  for (const r of list) {
    const key = normalizeEmail(r.email);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...r, email: key });
  }
  return out;
}
export function validate(list: ParsedRecipient[]): { valid: ParsedRecipient[]; invalid: string[] } {
  const valid: ParsedRecipient[] = [];
  const invalid: string[] = [];
  for (const r of list) (isValidEmail(r.email) ? valid.push(r) : invalid.push(r.email));
  return { valid, invalid };
}
export function parseSpreadsheet(buf: ArrayBuffer): ParsedRecipient[] {
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const out: ParsedRecipient[] = [];
  for (const row of rows) {
    const entries = Object.entries(row).map(
      ([k, v]) => [k.toLowerCase().trim(), String(v ?? "").trim()] as const,
    );
    const emailEntry = entries.find(([k]) => k === "email" || k.includes("email"));
    if (!emailEntry || !emailEntry[1]) continue;
    const mergeData: Record<string, string> = {};
    for (const [k, v] of entries) mergeData[k] = v;
    out.push({ email: normalizeEmail(emailEntry[1]), mergeData });
  }
  return out;
}
```
- [ ] **Step 4: Run — expect PASS**.
- [ ] **Step 5: Commit** (ASK FIRST) — `git add src/lib/email/recipients.* && git commit -m "feat(email): recipient parsing/validation/dedupe"`

---

### Task 2.5: GraphSender (token + sendMail, List-Unsubscribe via extended props)

**Files:** Create `src/lib/email/graph.ts`, `src/lib/email/graph.test.ts`

- [ ] **Step 1: Read the Graph shape** — `sendMail` returns **202** on success; token is client-credentials with scope `https://graph.microsoft.com/.default`. `List-*` headers must go in `singleValueExtendedProperties` under `PS_INTERNET_HEADERS` = `{00020386-0000-0000-C000-000000000046}`.

- [ ] **Step 2: Write the failing test** (mock `fetch`)
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GraphSender } from "./graph";

beforeEach(() => {
  process.env.MS_TENANT_ID = "t"; process.env.MS_CLIENT_ID = "c"; process.env.MS_CLIENT_SECRET = "s";
});

it("acquires a token then POSTs sendMail with List-Unsubscribe as an extended property", async () => {
  const calls: Array<{ url: string; body: string }> = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: any) => {
    calls.push({ url, body: String(init?.body ?? "") });
    if (url.includes("/oauth2/")) return new Response(JSON.stringify({ access_token: "TKN", expires_in: 3600 }), { status: 200 });
    return new Response(null, { status: 202, headers: { "request-id": "req-1" } });
  }));
  const r = await new GraphSender().send({
    from: "a@opelsoft.com", to: "v@x.com", subject: "Hi", html: "<p>hi</p>",
    headers: { "List-Unsubscribe": "<https://app/u?token=z>" },
  });
  expect(r.id).toBe("req-1");
  const sendBody = calls.find((c) => c.url.includes("sendMail"))!.body;
  expect(sendBody).toContain("singleValueExtendedProperties");
  expect(sendBody).toContain("Name List-Unsubscribe");
  expect(sendBody).not.toMatch(/"internetMessageHeaders"/);
});

it("throws with .status on non-202", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) =>
    url.includes("/oauth2/")
      ? new Response(JSON.stringify({ access_token: "T", expires_in: 3600 }), { status: 200 })
      : new Response("throttled", { status: 429 })));
  await expect(new GraphSender().send({ from: "a@x.com", to: "b@x.com", subject: "s", html: "h" }))
    .rejects.toMatchObject({ status: 429 });
});
```
- [ ] **Step 3: Run — expect FAIL**.
- [ ] **Step 4: Implement**
```ts
import "server-only";
import type { EmailSender, OutboundEmail } from "./types";

const PS_INTERNET_HEADERS = "{00020386-0000-0000-C000-000000000046}";
const tokenUrl = (t: string) => `https://login.microsoftonline.com/${t}/oauth2/v2.0/token`;
const sendUrl = (from: string) =>
  `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`;

let cached: { token: string; exp: number } | null = null;

async function getToken(): Promise<string> {
  const now = Date.now();
  if (cached && cached.exp > now + 60_000) return cached.token;
  const res = await fetch(tokenUrl(process.env.MS_TENANT_ID!), {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID!,
      client_secret: process.env.MS_CLIENT_SECRET!,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`token ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, exp: now + json.expires_in * 1000 };
  return cached.token;
}

export class GraphSender implements EmailSender {
  async send(msg: OutboundEmail): Promise<{ id: string }> {
    const token = await getToken();
    const message: Record<string, unknown> = {
      subject: msg.subject,
      body: { contentType: "HTML", content: msg.html },
      toRecipients: [{ emailAddress: { address: msg.to } }],
    };
    if (msg.replyTo) message.replyTo = [{ emailAddress: { address: msg.replyTo } }];
    const headers = Object.entries(msg.headers ?? {});
    if (headers.length) {
      message.singleValueExtendedProperties = headers.map(([name, value]) => ({
        id: `String ${PS_INTERNET_HEADERS} Name ${name}`,
        value,
      }));
    }
    const res = await fetch(sendUrl(msg.from), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message, saveToSentItems: true }),
    });
    if (res.status === 202) return { id: res.headers.get("request-id") ?? "accepted" };
    const err = new Error(`graph sendMail ${res.status}: ${await res.text()}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
}

export function __resetTokenCacheForTests() {
  cached = null;
}
```
> Note: `import "server-only"` is fine under vitest (it's a no-op export); if the test runner complains, add `server-only` to `test.server.deps.inline` in `vitest.config` or mock it. Keep the reset export for deterministic tests.
- [ ] **Step 5: Run — expect PASS**.
- [ ] **Step 6: Commit** (ASK FIRST) — `git add src/lib/email/graph.* && git commit -m "feat(email): Graph client-credentials sender"`

---

### Task 2.6: Sender factory

**Files:** Create `src/lib/email/index.ts`

- [ ] **Step 1: Write it**
```ts
import type { EmailSender } from "./types";
import { GraphSender } from "./graph";

let instance: EmailSender | null = null;

/** The one swap point. Phase 2: add AcsSender and switch on EMAIL_SENDER_BACKEND. */
export function getSender(): EmailSender {
  if (instance) return instance;
  const backend = process.env.EMAIL_SENDER_BACKEND ?? "graph";
  switch (backend) {
    case "graph":
      instance = new GraphSender();
      return instance;
    default:
      throw new Error(`Unknown EMAIL_SENDER_BACKEND: ${backend}`);
  }
}
export type { EmailSender, OutboundEmail } from "./types";
```
- [ ] **Step 2: Commit** (ASK FIRST) — `git add src/lib/email/index.ts && git commit -m "feat(email): sender factory (graph|acs swap point)"`

---

## Phase 3 — Data access, worker, and public endpoints

### Task 3.1: Service-role Supabase client (for the drain worker)

**Files:** Create `src/lib/supabase/admin.ts`

The drain runs with no user session (called by pg_cron), so it needs a service-role client that bypasses RLS.

- [ ] **Step 1: Write it**
```ts
import "server-only";
import { createClient as createAdmin } from "@supabase/supabase-js";

/** RLS-bypassing client. ONLY use in trusted server contexts (the drain worker). */
export function createServiceClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
```
- [ ] **Step 2: Commit** (ASK FIRST) — `git add src/lib/supabase/admin.ts && git commit -m "feat(email): service-role supabase client"`

---

### Task 3.2: Campaign data helpers + types

**Files:** Create `src/lib/campaigns.ts`

- [ ] **Step 1: Write it**
```ts
import { createClient } from "@/lib/supabase/server";

export type CampaignStatus = "draft" | "sending" | "paused" | "done" | "failed";
export type RecipientStatus = "queued" | "sending" | "sent" | "failed" | "suppressed";

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  from_address: string;
  reply_to: string | null;
  status: CampaignStatus;
  total: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
}
export interface Recipient {
  id: string;
  email: string;
  status: RecipientStatus;
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
}

const CAMPAIGN_COLS =
  "id, name, subject, body_html, from_address, reply_to, status, total, sent_count, failed_count, created_at";

export async function listCampaigns(): Promise<Campaign[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("email_campaigns").select(CAMPAIGN_COLS).order("created_at", { ascending: false });
  return (data as Campaign[] | null) ?? [];
}
export async function getCampaign(id: string): Promise<Campaign | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("email_campaigns").select(CAMPAIGN_COLS).eq("id", id).single();
  return (data as Campaign | null) ?? null;
}
export async function listRecipients(campaignId: string): Promise<Recipient[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("email_campaign_recipients")
    .select("id, email, status, attempts, last_error, sent_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  return (data as Recipient[] | null) ?? [];
}
```
- [ ] **Step 2: Commit** (ASK FIRST) — `git add src/lib/campaigns.ts && git commit -m "feat(email): campaign data helpers"`

---

### Task 3.3: Drain worker route (the sending engine)

**Files:** Create `src/app/api/campaigns/drain/route.ts`

- [ ] **Step 1: Read the route-handler guide** in `node_modules/next/dist/docs/` (POST handler signature for Next 16).

- [ ] **Step 2: Implement**
```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { getSender } from "@/lib/email";
import { buildOutbound, unsubscribeUrl } from "@/lib/email/render";

export const dynamic = "force-dynamic";
const BATCH = 28;
const STALE_MIN = 5;

export async function POST(request: NextRequest) {
  if (request.headers.get("x-drain-secret") !== process.env.EMAIL_DRAIN_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = createServiceClient();

  // 1) Reaper: reset rows stuck in 'sending' (a crashed prior tick) back to 'queued'.
  await db
    .from("email_campaign_recipients")
    .update({ status: "queued" })
    .eq("status", "sending")
    .lt("updated_at", new Date(Date.now() - STALE_MIN * 60_000).toISOString());

  // 2) Pick the oldest active campaign; short-circuit if none.
  const { data: campaign } = await db
    .from("email_campaigns")
    .select("id, subject, body_html, from_address, reply_to")
    .eq("status", "sending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ idle: true });

  // 3) Daily cap for this from_address.
  const cap = Number(process.env.EMAIL_DAILY_CAP ?? 800);
  const { data: sentToday } = await db.rpc("email_sent_last_24h", { p_from: campaign.from_address });
  const remaining = Math.max(0, cap - (sentToday ?? 0));
  if (remaining === 0) return NextResponse.json({ capped: true });

  // 4) Atomically claim a batch.
  const { data: claimed } = await db.rpc("claim_email_batch", {
    p_campaign: campaign.id,
    p_limit: Math.min(BATCH, remaining),
  });
  const batch = (claimed as Array<{ id: string; email: string; merge_data: Record<string, string>; unsubscribe_token: string }> | null) ?? [];

  if (batch.length === 0) {
    // Nothing queued left → campaign is done.
    await db.from("email_campaigns").update({ status: "done" }).eq("id", campaign.id);
    return NextResponse.json({ done: campaign.id });
  }

  const base = process.env.APP_BASE_URL ?? "";
  const sender = getSender();
  let sent = 0, failed = 0;

  for (const r of batch) {
    // Last-mile suppression check (someone may have unsubscribed after enqueue).
    const { data: sup } = await db
      .from("email_suppressions").select("id").ilike("email", r.email).limit(1).maybeSingle();
    if (sup) {
      await db.from("email_campaign_recipients").update({ status: "suppressed" }).eq("id", r.id);
      continue;
    }
    try {
      const msg = buildOutbound({
        from: campaign.from_address,
        replyTo: campaign.reply_to ?? undefined,
        to: r.email,
        subject: campaign.subject,
        bodyTemplate: campaign.body_html,
        mergeData: r.merge_data ?? {},
        unsubUrl: unsubscribeUrl(base, r.unsubscribe_token),
      });
      const { id } = await sender.send(msg);
      await db.from("email_campaign_recipients")
        .update({ status: "sent", message_id: id, sent_at: new Date().toISOString(), last_error: null })
        .eq("id", r.id);
      sent++;
    } catch (e) {
      const status = (e as { status?: number }).status ?? 0;
      const retryable = status === 429 || status >= 500;
      await db.from("email_campaign_recipients")
        .update({ status: retryable ? "queued" : "failed", last_error: String((e as Error).message).slice(0, 500) })
        .eq("id", r.id);
      if (!retryable) failed++;
      if (status === 429) break; // back off this tick; pg_cron retries in 60s
    }
  }

  // 5) Update campaign counters.
  await db.from("email_campaigns")
    .update({
      sent_count: (await countBy(db, campaign.id, "sent")),
      failed_count: (await countBy(db, campaign.id, "failed")),
    })
    .eq("id", campaign.id);

  return NextResponse.json({ campaign: campaign.id, sent, failed });
}

async function countBy(db: ReturnType<typeof createServiceClient>, campaignId: string, status: string): Promise<number> {
  const { count } = await db
    .from("email_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", status);
  return count ?? 0;
}
```
- [ ] **Step 3: Smoke-test the auth guard**

Run the dev server (`npm run dev`), then:
```bash
curl -s -X POST http://localhost:3000/api/campaigns/drain -H "x-drain-secret: wrong" | cat   # {"error":"unauthorized"}
curl -s -X POST http://localhost:3000/api/campaigns/drain -H "x-drain-secret: $EMAIL_DRAIN_SECRET" | cat  # {"idle":true} with no active campaign
```
Expected: 401 for wrong secret; `{"idle":true}` for correct secret when nothing is sending.

- [ ] **Step 4: Commit** (ASK FIRST) — `git add src/app/api/campaigns/drain/route.ts && git commit -m "feat(email): drain worker (claim/send/retry/cap/suppress)"`

---

### Task 3.4: Unsubscribe endpoint

**Files:** Create `src/app/api/unsubscribe/route.ts`

- [ ] **Step 1: Implement** (GET = human click + confirmation page; POST = RFC 8058 one-click)
```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";

async function suppress(token: string): Promise<boolean> {
  if (!token) return false;
  const db = createServiceClient();
  const { data: r } = await db
    .from("email_campaign_recipients")
    .select("email, campaign_id")
    .eq("unsubscribe_token", token)
    .maybeSingle();
  if (!r) return false;
  await db.from("email_suppressions").upsert(
    { email: r.email, reason: "unsubscribe", source_campaign_id: r.campaign_id },
    { onConflict: "email", ignoreDuplicates: true },
  );
  return true;
}

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const ok = await suppress(token);
  const html = ok
    ? "<h2>You're unsubscribed.</h2><p>You won't receive further outreach from OpelSoft.</p>"
    : "<h2>Link invalid or expired.</h2>";
  return new NextResponse(html, { status: ok ? 200 : 404, headers: { "content-type": "text/html" } });
}

export async function POST(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const ok = await suppress(token);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
```
> `email_suppressions` has a unique index on `lower(email)`; the `upsert(onConflict:"email")` relies on a matching constraint. If Supabase rejects `onConflict:"email"` (needs a named unique constraint), replace with a pre-check: `select` by `ilike(email)`, and `insert` only if absent. Include that fallback if the upsert errors during Step 2.

- [ ] **Step 2: Smoke test** — create a recipient row manually with a known token, GET `/api/unsubscribe?token=...`, confirm a row lands in `email_suppressions`. Re-GET → still 200, no duplicate.

- [ ] **Step 3: Commit** (ASK FIRST) — `git add src/app/api/unsubscribe/route.ts && git commit -m "feat(email): one-click unsubscribe endpoint"`

---

### Task 3.5: Schedule the drain with pg_cron (user — Supabase SQL editor)

- [ ] **Step 1: Enable extensions** — Supabase Dashboard → **Database → Extensions** → enable **`pg_cron`** and **`pg_net`**.
- [ ] **Step 2: Schedule the every-minute drain** (SQL editor). Replace the URL + secret:
```sql
select cron.schedule(
  'drain-emails',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://<your-cloud-run-url>/api/campaigns/drain',
    headers := jsonb_build_object('Content-Type','application/json','x-drain-secret','<EMAIL_DRAIN_SECRET>')
  );
  $$
);
```
- [ ] **Step 3: Verify** — `select * from cron.job;` shows `drain-emails`. To unschedule later: `select cron.unschedule('drain-emails');`.

---

## Phase 4 — Server actions + UI

### Task 4.1: Campaign server actions

**Files:** Create `src/app/(app)/campaigns/actions.ts`

- [ ] **Step 1: Read the Server Actions guide** in `node_modules/next/dist/docs/`.
- [ ] **Step 2: Implement**
```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { dedupe, validate, parseManualList, parseSpreadsheet, type ParsedRecipient } from "@/lib/email/recipients";

const SENDERS = (process.env.EMAIL_SENDER_ADDRESSES ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export async function createAndStartCampaign(_prev: unknown, fd: FormData) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };

  const name = String(fd.get("name") ?? "").trim();
  const subject = String(fd.get("subject") ?? "").trim();
  const body_html = String(fd.get("body_html") ?? "").trim();
  const from_address = String(fd.get("from_address") ?? "").trim();
  const reply_to = String(fd.get("reply_to") ?? "").trim() || null;
  if (!name || !subject || !body_html) return { error: "Name, subject and body are required." };
  if (!SENDERS.includes(from_address)) return { error: "From address is not allow-listed." };

  const supabase = await createClient();

  // Gather recipients from the 3 sources.
  let recipients: ParsedRecipient[] = [];
  const manual = String(fd.get("manual") ?? "").trim();
  if (manual) recipients.push(...parseManualList(manual));

  const file = fd.get("file");
  if (file && file instanceof File && file.size > 0) {
    recipients.push(...parseSpreadsheet(await file.arrayBuffer()));
  }

  const vendorIdsRaw = String(fd.get("vendor_ids") ?? "").trim();
  const vendorMap = new Map<string, string>(); // email -> vendor_id
  if (vendorIdsRaw) {
    const ids = vendorIdsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    const { data: vs } = await supabase.from("vendors").select("id, email, contact_name, name").in("id", ids);
    for (const v of vs ?? []) {
      if (!v.email) continue;
      recipients.push({ email: v.email, mergeData: { contact_name: v.contact_name ?? "", vendor_name: v.name ?? "" } });
      vendorMap.set(v.email.toLowerCase(), v.id);
    }
  }

  const { valid } = validate(dedupe(recipients));
  if (valid.length === 0) return { error: "No valid recipients found." };

  // Drop anyone already suppressed.
  const { data: sups } = await supabase.from("email_suppressions").select("email");
  const suppressed = new Set((sups ?? []).map((s) => s.email.toLowerCase()));
  const finalRecipients = valid.filter((r) => !suppressed.has(r.email));
  if (finalRecipients.length === 0) return { error: "All recipients are on the suppression list." };

  // Create campaign (draft→sending) then insert recipient rows.
  const { data: campaign, error: cErr } = await supabase
    .from("email_campaigns")
    .insert({ name, subject, body_html, from_address, reply_to, status: "sending", total: finalRecipients.length, created_by: me.id })
    .select("id")
    .single();
  if (cErr || !campaign) return { error: cErr?.message ?? "Failed to create campaign." };

  const rows = finalRecipients.map((r) => ({
    campaign_id: campaign.id,
    vendor_id: vendorMap.get(r.email) ?? null,
    email: r.email,
    merge_data: r.mergeData,
  }));
  const { error: rErr } = await supabase.from("email_campaign_recipients").insert(rows);
  if (rErr) return { error: rErr.message };

  revalidatePath("/campaigns");
  redirect(`/campaigns/${campaign.id}`);
}

export async function setCampaignStatus(id: string, status: "sending" | "paused") {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const supabase = await createClient();
  const { error } = await supabase.from("email_campaigns").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/campaigns/${id}`);
  return { ok: true as const };
}
```
- [ ] **Step 3: Commit** (ASK FIRST) — `git add "src/app/(app)/campaigns/actions.ts" && git commit -m "feat(email): campaign create/start/pause actions"`

---

### Task 4.2: Campaigns list page

**Files:** Create `src/app/(app)/campaigns/page.tsx`

- [ ] **Step 1: Implement** (server component; follow the visual pattern of `src/app/(app)/vendors/page.tsx`)
```tsx
import Link from "next/link";
import { listCampaigns } from "@/lib/campaigns";

export default async function CampaignsPage() {
  const campaigns = await listCampaigns();
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Email Campaigns</h1>
        <Link href="/campaigns/new" className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground">New Campaign</Link>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground">
          <th className="py-2">Name</th><th>Status</th><th>Sent</th><th>Failed</th><th>Total</th><th>Created</th>
        </tr></thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="py-2"><Link href={`/campaigns/${c.id}`} className="underline">{c.name}</Link></td>
              <td>{c.status}</td><td>{c.sent_count}</td><td>{c.failed_count}</td><td>{c.total}</td>
              <td>{new Date(c.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
          {campaigns.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No campaigns yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
```
- [ ] **Step 2: Commit** (ASK FIRST).

---

### Task 4.3: New-campaign composer (client component + page)

**Files:** Create `src/app/(app)/campaigns/new/page.tsx`, `src/app/(app)/campaigns/new/Composer.tsx`

- [ ] **Step 1: Page (server) — load vendor options + sender list**
```tsx
import { vendorOptions } from "@/lib/vendors";
import Composer from "./Composer";

export default async function NewCampaignPage() {
  const vendors = await vendorOptions();
  const senders = (process.env.EMAIL_SENDER_ADDRESSES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const replyTo = process.env.EMAIL_DEFAULT_REPLY_TO ?? "";
  return <Composer vendors={vendors} senders={senders} defaultReplyTo={replyTo} />;
}
```
- [ ] **Step 2: Composer (client) — 3 sources, compose, live spam-check, submit**
```tsx
"use client";
import { useMemo, useState } from "react";
import { useFormState } from "react-dom";
import type { VendorOption } from "@/lib/vendors";
import { spamCheck } from "@/lib/email/spamCheck";
import { createAndStartCampaign } from "../actions";

export default function Composer({ vendors, senders, defaultReplyTo }: {
  vendors: VendorOption[]; senders: string[]; defaultReplyTo: string;
}) {
  const [state, action] = useFormState(createAndStartCampaign, null as null | { error?: string });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const spam = useMemo(() => spamCheck({ subject, html: body }), [subject, body]);

  return (
    <form action={action} className="p-6 grid gap-4 max-w-3xl">
      <h1 className="text-xl font-semibold">New Campaign</h1>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <input name="name" placeholder="Campaign name" className="border rounded px-2 py-1" required />

      <div className="grid gap-1">
        <label className="text-sm">Recipients — pick vendors</label>
        <select multiple value={selected} onChange={(e) => setSelected(Array.from(e.target.selectedOptions, (o) => o.value))}
          className="border rounded px-2 py-1 h-32">
          {vendors.filter((v) => v.email).map((v) => <option key={v.id} value={v.id}>{v.name} — {v.email}</option>)}
        </select>
        <input type="hidden" name="vendor_ids" value={selected.join(",")} />
        <label className="text-sm mt-2">…or paste emails (comma / newline separated)</label>
        <textarea name="manual" rows={3} className="border rounded px-2 py-1" placeholder="a@x.com, b@y.com" />
        <label className="text-sm mt-2">…or upload Excel/CSV (needs an "email" column)</label>
        <input type="file" name="file" accept=".xlsx,.xls,.csv" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select name="from_address" className="border rounded px-2 py-1">
          {senders.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input name="reply_to" defaultValue={defaultReplyTo} placeholder="Reply-To" className="border rounded px-2 py-1" />
      </div>

      <input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject" className="border rounded px-2 py-1" required />
      <textarea name="body_html" value={body} onChange={(e) => setBody(e.target.value)}
        rows={12} placeholder="HTML body — use {{contact_name}} / {{vendor_name}}" className="border rounded px-2 py-1 font-mono text-sm" required />

      {spam.warnings.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-medium">⚠️ Spam check ({spam.warnings.length}) — you can still send:</p>
          <ul className="list-disc pl-5">
            {spam.warnings.map((w, i) => <li key={i} className={w.severity === "high" ? "text-red-700" : ""}>{w.message}</li>)}
          </ul>
        </div>
      )}

      <div className="rounded border p-3 text-sm">
        <p className="font-medium mb-1">Preview</p>
        <div dangerouslySetInnerHTML={{ __html: body }} />
      </div>

      <button className="rounded bg-primary px-4 py-2 text-primary-foreground w-fit">Create & start sending</button>
    </form>
  );
}
```
> If `useFormState` is not exported from `react-dom` in this React 19 build, use `useActionState` from `react` instead (`const [state, action] = useActionState(createAndStartCampaign, null)`). Check the Next server-actions doc; use whichever the codebase's other forms use (grep `useFormState`/`useActionState`).
- [ ] **Step 3: Commit** (ASK FIRST).

---

### Task 4.4: Campaign detail + live progress (read-only polling)

**Files:** Create `src/app/(app)/campaigns/[id]/page.tsx`, `src/app/(app)/campaigns/[id]/Progress.tsx`

- [ ] **Step 1: Page (server) — `params` is a Promise in Next 16, await it**
```tsx
import { notFound } from "next/navigation";
import { getCampaign, listRecipients } from "@/lib/campaigns";
import Progress from "./Progress";

export default async function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();
  const recipients = await listRecipients(id);
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">{campaign.name}</h1>
      <p className="text-sm text-muted-foreground">From {campaign.from_address} · {campaign.status}</p>
      <Progress id={id} initialStatus={campaign.status} total={campaign.total} sent={campaign.sent_count} failed={campaign.failed_count} />
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground"><th className="py-2">Email</th><th>Status</th><th>Attempts</th><th>Error</th></tr></thead>
        <tbody>
          {recipients.map((r) => (
            <tr key={r.id} className="border-t"><td className="py-1">{r.email}</td><td>{r.status}</td><td>{r.attempts}</td><td className="text-red-600">{r.last_error ?? ""}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```
- [ ] **Step 2: Progress (client) — polls, shows bar + pause/resume. Sending itself is pg_cron; this only displays.**
```tsx
"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CampaignStatus } from "@/lib/campaigns";
import { setCampaignStatus } from "../actions";

export default function Progress({ id, initialStatus, total, sent, failed }: {
  id: string; initialStatus: CampaignStatus; total: number; sent: number; failed: number;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (status !== "sending") return;
    const t = setInterval(() => startTransition(() => router.refresh()), 15_000);
    return () => clearInterval(t);
  }, [status, router]);

  const pct = total ? Math.round(((sent + failed) / total) * 100) : 0;
  async function toggle(next: "sending" | "paused") { await setCampaignStatus(id, next); setStatus(next); router.refresh(); }

  return (
    <div className="space-y-2">
      <div className="h-3 w-full rounded bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
      <p className="text-sm">{sent} sent · {failed} failed · {total} total ({pct}%)</p>
      {status === "sending" && <button onClick={() => toggle("paused")} className="rounded border px-3 py-1 text-sm">Pause</button>}
      {status === "paused" && <button onClick={() => toggle("sending")} className="rounded border px-3 py-1 text-sm">Resume</button>}
    </div>
  );
}
```
> Note: this page **displays** progress; the actual sending runs unattended via pg_cron, so closing the tab does not stop it. The pause/resume flips `email_campaigns.status`, which the drain checks each tick.
- [ ] **Step 3: Commit** (ASK FIRST).

---

### Task 4.5: Add nav link

**Files:** Modify the app sidebar/nav (find it: `grep -rl "vendors" src/app/**/*.tsx src/components/**/*.tsx | head`).

- [ ] **Step 1:** Add a "Campaigns" link to `/campaigns` next to the existing "Vendors" nav item, matching the surrounding markup exactly.
- [ ] **Step 2: Commit** (ASK FIRST).

---

## Phase 5 — Verification

### Task 5.1: Full unit suite green
- [ ] Run `npm test`. Expected: all `src/lib/email/*.test.ts` pass. Fix any red before moving on.

### Task 5.2: Live smoke send (controlled)
- [ ] With DNS PASS (Task 0.4) confirmed, create a campaign to **one seed address you control** (a Gmail). Let pg_cron drain it (or `curl` the drain once with the secret).
- [ ] Open the received mail → **Show original** → confirm **SPF/DKIM/DMARC = PASS** and that a **List-Unsubscribe** header is present (proves the extended-property path worked). If the header is missing, note it and rely on the visible footer link for Phase 1 (documented fallback in the spec).
- [ ] Confirm the `email_campaign_recipients` row shows `status=sent` with a `message_id`.

### Task 5.3: Unsubscribe round-trip
- [ ] Click the Unsubscribe link in the received mail → confirm the confirmation page → confirm a row appears in `email_suppressions` → create a second campaign to the same address → confirm it is dropped as suppressed (not sent).

### Task 5.4: Spec-coverage review
- [ ] Re-read the spec §3 scope list; confirm each item maps to a task above. Confirm no secret values were committed (`git log -p | grep -iE "client_secret|service_role|smtp_pass"` returns nothing in tracked files).

---

## Self-review notes (author)

- **Spec coverage:** sender seam (2.1/2.5/2.6) · 3 recipient sources (2.4 + 4.1/4.3) · composer + spam-check (2.3 + 4.3) · durable throttled send (1.1 RPCs + 3.3 drain + 3.5 cron) · unsubscribe + suppression + footer (2.2 + 3.4 + drain) · send log + status UI (1.1 + 4.4) · From/Reply-To (4.1/4.3) · security (0.1/0.2/3.1) · DNS (0.4). All spec §3 in-scope items mapped.
- **Type consistency:** `OutboundEmail`/`EmailSender` (2.1) used identically in 2.5/2.6/3.3; `ParsedRecipient` (2.4) used in 4.1; RPC names `claim_email_batch`/`email_sent_last_24h` defined in 1.1 and called in 3.3; recipient statuses (`queued|sending|sent|failed|suppressed`) consistent across 1.1/3.3/4.4.
- **Known verification gates (not placeholders — real unknowns to confirm at build time):** (a) `List-Unsubscribe` via extended property lands (Task 5.2); (b) `upsert(onConflict:"email")` vs the `lower(email)` index (Task 3.4 fallback noted); (c) `useFormState` vs `useActionState` in this React 19 build (Task 4.3 note).

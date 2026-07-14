# Bulk Email Outreach — Design Spec

- **Date:** 2026-07-13
- **Branch:** `feat/bulk-email-outreach` (off `snsettitech/main` — the current shared main; new migrations land at `0017+`)
- **Status:** Approved for implementation-planning
- **Owner:** OpelSoft dashboard team

---

## 1. Goal

Replace the manual Power Automate "Initial Email Outreach" flow with a dashboard-native
bulk-email feature: compose a campaign, choose recipients (vendors table / Excel upload /
manual entry), personalize, spam-check, and send throttled + compliant email — with a
per-recipient send log. Built on **Microsoft Graph** now, behind a swappable sender so we
can move to **Azure Communication Services (ACS) Email** when volume scales.

## 2. Volume phases (drives the whole architecture)

| Phase | Volume | Backend | Notes |
|---|---|---|---|
| **1 — now** | <1k/day, bursts up to ~800/hour | **Graph API** from `alex.smith@opelsoft.com` (paid M365 tenant, confirmed) | Within Exchange limits: 30 msg/min, 10k recipients/day per mailbox. 800 drains in ~27–30 min. |
| **2 — later** | ~200k/month sustained | **Azure Communication Services Email** (verified opelsoft.com domain) | Microsoft's own bulk product; Exchange Online is contractually **not** for bulk/marketing. Swap = change the sender implementation + env, no rewrite. |

**Why not Graph for 200k/month:** the raw rate limits *almost* fit one paid mailbox, but
Exchange Online's terms forbid bulk/marketing sending and its abuse systems throttle/restrict
mailboxes that show cold-bulk patterns. Microsoft explicitly recommends ACS for this. See
`docs/` research links in the brainstorming thread.

## 3. Scope

### In scope (Phase 1 — build now)
1. **Sender seam** — one interface, Graph implementation.
2. **3 recipient sources** — vendors table select, Excel/CSV upload, manual type/paste.
3. **Campaign composer** — custom subject + HTML body, live preview, merge fields.
4. **Spam linter** — rules-based pre-send warnings (non-blocking).
5. **Durable throttled sending** — Postgres queue + per-minute drain, auto-resume, rate-limit safe.
6. **Compliance** — one-click unsubscribe (`List-Unsubscribe` + `List-Unsubscribe-Post` headers +
   visible link), CAN-SPAM footer with physical address, suppression list enforced before every send.
7. **Send log + status UI** — per-recipient sent/queued/failed/suppressed with error detail.
8. **From/Reply-To control** — From is derived server-side from the logged-in user (`senderFor`:
   admins send as the shared outreach mailbox, others as their own `@opelsoft.com` mailbox), never
   trusted from the form; Reply-To defaults to the signatory.

### Out of scope (Phase 2 — seams left, not built)
- ACS/SES sender implementation (interface exists; impl deferred).
- Multiple sending subdomains + IP warmup automation.
- Automated warmup ramp scheduling.
- Full bounce/NDR ingestion (Phase 1: suppress on unsubscribe + hard send-failure only;
  reading bounce-back NDRs is Phase 1.5).
- A/B subject testing, open/click tracking pixels (deliberately omitted — tracking pixels
  hurt deliverability for cold outreach).

## 4. Architecture

### 4.1 Sender seam (the swap point)
```
src/lib/email/sender.ts     interface EmailSender { send(msg: OutboundEmail): Promise<{ id: string }> }  // throws on failure
                            type OutboundEmail = { from; replyTo?; to; subject; html; headers?: Record<string,string> }
src/lib/email/graph.ts      GraphSender — client_credentials token (cached ~55 min in-memory),
                            POST https://graph.microsoft.com/v1.0/users/{from}/sendMail
src/lib/email/index.ts      getSender() — returns GraphSender today; ACS/SES swap = one line + env
```
Existing `src/lib/mail.ts` (nodemailer, transactional single emails) is **untouched** — different concern.

### 4.2 Data model (3 new Supabase tables — Supabase is the app's existing Postgres DB)
Mirror the existing `activity_logs` conventions (RLS on, `created_by`, timestamps, triggers where useful).

**`email_campaigns`**
`id, name, subject, body_html, from_address, reply_to, status(draft|queued|sending|paused|done|failed), total, sent_count, failed_count, created_by, created_at, updated_at`

**`email_campaign_recipients`** — this **is** the send log
`id, campaign_id(fk), vendor_id(fk, nullable), email, merge_data(jsonb), status(queued|sent|failed|suppressed), attempts(int, default 0), last_error(text), message_id(text), unsubscribe_token(uuid, unique), sent_at, created_at`
- Unique on `(campaign_id, email)` to guard duplicates within a campaign.

**`email_suppressions`** — the never-email list
`id, email(citext, unique), reason(unsubscribe|bounce|complaint|manual), source_campaign_id(nullable), created_at`
- Checked (case-insensitive) before every enqueue and before every send.

### 4.3 Sending pipeline (durable + throttled) — Phase 1: Supabase `pg_cron` (unattended)
1. **Compose & enqueue** (Server Action): resolve recipients from the 3 sources → validate email
   format → de-dupe → drop anyone in `email_suppressions` → insert `email_campaign_recipients`
   rows as `queued` → set campaign `sending`.
2. **Drain** (`POST /api/campaigns/drain`, protected by the `EMAIL_DRAIN_SECRET` header): each call
   - **short-circuits** (returns immediately) if no campaign is `sending` — keeps idle ticks free,
   - grabs up to **N=28** oldest `queued` rows with `FOR UPDATE SKIP LOCKED` (safe against overlapping ticks),
   - enforces a **daily cap** (config `EMAIL_DAILY_CAP`, default 800; count `sent` in trailing 24h per from-address),
   - renders merge fields + appends unsubscribe footer, calls `sender.send()`,
   - on success → `sent` + `message_id` + `sent_at`; on `429`/`5xx` → leave `queued`, `attempts++`,
     record `last_error` (retried next tick); on permanent 4xx (bad address) → `failed`,
   - marks campaign `done` when no `queued` rows remain.
3. **Trigger: Supabase `pg_cron`, every minute (unattended).** A `cron.schedule('drain-emails', '* * * * *', …)`
   job uses `pg_net.http_post` to POST the drain endpoint with the secret header. **No tab to keep open —
   fire-and-forget:** start a campaign, close the laptop; it drains on its own and **auto-resumes** after any
   crash (state lives in `email_campaign_recipients`; status transitions + `SKIP LOCKED` prevent double-sends).
   CPU cost is negligible — the cron fires one tiny HTTP call; all send work runs in the Cloud Run app, not
   the DB. Setup = enable `pg_cron` + `pg_net` extensions and run one `cron.schedule` statement (click-by-click
   in the impl plan). The campaign page **polls read-only** for the live progress bar — it displays, it does
   not drive sending.

**Burst handling:** an 800-recipient campaign drains at ~28/min → ~29 min, unattended, under the 10k/day cap.

**Scaling boundary (why this is Phase-1 only).** 30/min is **Exchange's hard cap, not our throttle** —
M365 cannot send faster, period. At **6–8k/day** that's 3.5–4.5 h of sending and past what Exchange tolerates
for cold bulk. That volume is the **Phase-2 / ACS** trigger: ACS lifts the 30/min cap (1–2M/hour). The pg_cron
trigger stays as-is; only the sender impl (`graph` → `acs`) and `EMAIL_DAILY_CAP` change. (If you ever leave
Supabase, Google Cloud Scheduler → the same `/api/campaigns/drain` is a drop-in replacement for the cron.)

### 4.4 Recipient sources (all converge on the same enqueue path)
- **Vendors:** filtered select from `vendors` (has one `email` each) → keeps `vendor_id` for history.
- **Excel/CSV upload:** parse with existing `xlsx`; map an email column; validate rows.
- **Manual entry:** textarea, paste/type addresses (comma/newline separated); validate.
Merge data (`vendor_name`, `contact_name`) captured where available for personalization.

### 4.5 Spam linter (pre-send, non-blocking)
`src/lib/email/spamCheck.ts` — pure function over `{subject, html}` → `{score, warnings[]}`.
Rules (catches the common 90%; no ML):
- Trigger words in subject/body (free, guarantee, act now, urgent, $$$, 100%, click here, winner…).
- ALL-CAPS words / `!!!` / excessive punctuation.
- Link count and text-to-link ratio; URL shorteners.
- Image-only / very low text-to-image ratio; images missing `alt`.
- Missing unsubscribe link or `List-Unsubscribe`.
- Heavy colored text (esp. red), over-stacked emphasis (`<b><i><u>` together).
- Subject length / empty subject.
- Image hosted off the sending domain (trust mismatch).
Shown in the composer before Send; user can fix or send anyway.

### 4.6 Compliance & "look genuine"
- **Unsubscribe:** public `GET /api/unsubscribe?token=…` (also honors one-click `POST`) → insert into
  `email_suppressions(reason=unsubscribe)`. Every email carries `List-Unsubscribe` +
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers **and** a visible footer link.
  **Graph caveat:** `internetMessageHeaders` only allows `x-` prefixed names, so these two headers are
  set via **`singleValueExtendedProperties`** under the `PS_INTERNET_HEADERS` property set
  (`{00020386-0000-0000-C000-000000000046}`). Confirmed in a smoke test; falls back to visible-link-only
  if a tenant blocks it. (ACS sets them natively in Phase 2.)
- **CAN-SPAM footer** (auto-appended): physical address + unsubscribe.
  Address: `OpelSoft LLC, 255 Old New Brunswick Road, Suite N210, Piscataway, NJ 08854`.
- **From/Reply-To:** From = derived from the logged-in user via `senderFor` (admins → shared
  outreach mailbox `EMAIL_SENDER_ADDRESSES[0]`, others → their own `@opelsoft.com` mailbox);
  Reply-To = signatory (e.g. `harsh@opelsoft.com`) so replies reach the real person.
- **Personalization:** merge `{{vendor_name}}`/`{{contact_name}}` so no two bodies are byte-identical
  and "Dear Vendors" becomes "Dear {{contact_name}}".
- **Throttle + daily cap + suppression** as in 4.3.

## 5. Reference template + its spam analysis (from the real sample)

The provided outreach HTML is the working template. Linter/deliverability notes to apply:
1. **No unsubscribe** → **must add** (header + footer). Highest priority.
2. **`[harsh@opelsoft.com](mailto:…)` is Markdown inside HTML** → renders literally. Fix to
   `<a href="mailto:harsh@opelsoft.com">harsh@opelsoft.com</a>`.
3. **Red text `#C82613`** and **stacked `<b><i><u>`** on "Reply if interested…" → mute; strong
   spam-styling signals. Prefer one emphasis, neutral colors.
4. **"Dear Vendors"** generic → personalize with merge field.
5. **Logo hosted on `opelsoft.vercel.app`** (≠ sending domain) and **no `alt`** → host on
   `opelsoft.com`, add `alt="OpelSoft"`.
6. **From/signature mismatch** (send-from alex.smith vs signed Harsh) → set Reply-To to Harsh, or
   have Harsh create the campaign (non-admins send as their own mailbox automatically).
Subject from the old flow ("Looks Like You're Sharing a Requirement") is acceptable — not spammy.

## 6. UI

New route group `src/app/(app)/campaigns/`:
- **`/campaigns`** — list campaigns with status + counts.
- **`/campaigns/new`** — wizard: (1) recipients (vendors filter / upload / manual), (2) compose
  (From shown read-only — derived from the logged-in user, Reply-To, subject, HTML body, live
  preview + recipient count), (3) spam-check
  panel + Send.
- **`/campaigns/[id]`** — live progress bar (polls read-only) + per-recipient status table
  (sent/queued/failed/suppressed + error), **Pause/Resume**. Sending runs **unattended via pg_cron**
  (§4.3.3) — this page only *displays* progress; closing it does not stop the send.
Mutations via `actions.ts` Server Actions (matches every other feature dir). shadcn + Tailwind v4.

## 7. Config / env (added to `.env.local`, and documented in a new `.env.example`)

```
MS_TENANT_ID=            # Azure AD tenant
MS_CLIENT_ID=            # registered app (done)
MS_CLIENT_SECRET=        # app secret  (SECURITY: see §9)
EMAIL_SENDER_ADDRESSES=alex.smith@opelsoft.com   # comma-separated; [0] = shared outreach mailbox (admin From + fallback)
EMAIL_DEFAULT_REPLY_TO=harsh@opelsoft.com
EMAIL_DAILY_CAP=800
EMAIL_SENDER_BACKEND=graph                        # graph | acs (Phase 2 swap)
EMAIL_DRAIN_SECRET=      # guards POST /api/campaigns/drain (called every minute by pg_cron via pg_net)
APP_BASE_URL=            # e.g. https://opelsoft-dashboard...run.app — pg_cron posts the drain here
```

## 8. Azure / M365 setup (user, click-by-click in the impl plan)
1. App already registered → add **`Mail.Send` Application permission** → **Grant admin consent**.
   (Trim any extra granted permissions — least privilege.)
2. Create an **Application Access Policy** scoping the app to `alex.smith@opelsoft.com` (and any
   other allow-listed senders) so a leaked secret can't email the whole tenant.
3. Create a **client secret**; copy value once into `.env.local`.
4. Confirm paid (non-trial) tenant — **confirmed**.

## 9. Security
- `.env.local` currently contains live SMTP + Supabase secrets committed to git (plaintext).
  **Before any push:** move real secrets out of tracked files, ensure `.env.local` is gitignored,
  add `.env.example` with key names only, and rotate anything that was exposed. The new
  `MS_CLIENT_SECRET` and `EMAIL_DRAIN_SECRET` go into the untracked `.env.local` only.
- Drain endpoint requires `EMAIL_DRAIN_SECRET`; unsubscribe endpoint uses per-recipient tokens.
- Application Access Policy (§8.2) is the blast-radius control for `Mail.Send`.

## 10. DNS / deliverability checklist (verify before first real send)
- **SPF** `opelsoft.com` includes `spf.protection.outlook.com`, ends `-all`.
- **DKIM** enabled for opelsoft.com in Defender portal; `selector1/2._domainkey` resolve.
- **DMARC** `_dmarc.opelsoft.com` present (`p=none` to start, tighten later).
- Ground-truth test: send to a Gmail → *Show original* → SPF/DKIM/DMARC = PASS.
- Operational playbook: warm up volume, keep bounces <2% and complaints <0.3%, prune bad
  addresses (suppression list), consistent sending hours.

## 11. Testing
- `spamCheck` — unit tests (vitest, already in repo): known-spammy vs clean inputs assert warnings.
- Merge-field render + footer/unsubscribe injection — unit test.
- Suppression enforcement — test that a suppressed address is never enqueued/sent.
- Drain rate/daily-cap logic — test batch size + cap guard.
- Graph sender — integration test behind a flag (mock token + sendMail); one live smoke send to a
  seed inbox during rollout.

## 12. Phase-2 migration note (ACS)
When crossing sustained thousands/day: implement `AcsSender` behind the same interface, verify
opelsoft.com in ACS, set `EMAIL_SENDER_BACKEND=acs`, raise `EMAIL_DAILY_CAP`, add sending
subdomains + warmup. Campaign model, UI, unsubscribe, suppression, spam linter, and send log all
carry over unchanged.

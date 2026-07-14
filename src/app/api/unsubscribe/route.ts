import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { normalizeEmail } from "@/lib/email/recipients";

async function lookupRecipient(token: string): Promise<{ email: string; campaign_id: string } | null> {
  if (!token) return null;
  const db = createServiceClient();
  const { data: r } = await db
    .from("email_campaign_recipients")
    .select("email, campaign_id")
    .eq("unsubscribe_token", token)
    .maybeSingle();
  return r ?? null;
}

async function suppress(token: string): Promise<boolean> {
  const r = await lookupRecipient(token);
  if (!r) return false;
  const db = createServiceClient();
  // eq, not ilike: '_'/'%' in an address are LIKE wildcards, not literal characters.
  const { data: existing } = await db
    .from("email_suppressions").select("id").eq("email", normalizeEmail(r.email)).limit(1).maybeSingle();
  if (!existing) {
    const { error } = await db.from("email_suppressions").insert(
      { email: r.email, reason: "unsubscribe", source_campaign_id: r.campaign_id },
    );
    // Benign race: another request suppressed the same email between our check and insert.
    // The unique index on lower(email) is the real guard — a conflict just means "already suppressed".
    if (error && error.code !== "23505") throw error;
  }
  return true;
}

// GET must not change state: corporate mail scanners (e.g. SafeLinks) prefetch
// GET links, which would auto-unsubscribe people who never clicked. Read-only
// lookup here; the actual suppression happens on POST (form submit or RFC 8058
// one-click), which scanners don't perform.
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const r = await lookupRecipient(token);
  if (!r) {
    return new NextResponse("<h2>Link invalid or expired.</h2>", {
      status: 404,
      headers: { "content-type": "text/html" },
    });
  }
  const html = `<h2>Unsubscribe from OpelSoft emails?</h2>
<p>Click the button to stop receiving outreach at this address.</p>
<form method="post"><button type="submit" style="padding:8px 16px;font-size:14px">Unsubscribe</button></form>`;
  return new NextResponse(html, { status: 200, headers: { "content-type": "text/html" } });
}

export async function POST(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const ok = await suppress(token);
  // The browser form expects a page; RFC 8058 one-click callers only check the status.
  if (request.headers.get("accept")?.includes("text/html")) {
    const html = ok
      ? "<h2>You're unsubscribed.</h2><p>You won't receive further outreach from OpelSoft.</p>"
      : "<h2>Link invalid or expired.</h2>";
    return new NextResponse(html, { status: ok ? 200 : 404, headers: { "content-type": "text/html" } });
  }
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}

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
  const { data: existing } = await db
    .from("email_suppressions").select("id").ilike("email", r.email).limit(1).maybeSingle();
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

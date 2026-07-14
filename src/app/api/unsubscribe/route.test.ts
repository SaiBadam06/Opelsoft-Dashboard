import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeDb } from "../../../../test/fake-db";
import { GET, POST } from "./route";

const state = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof import("../../../../test/fake-db").makeDb> }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceClient: () => state.db }));

const RECIPIENT = { email: "John_Doe@vendor.com", campaign_id: "c1" };

function req(method: "GET" | "POST", token: string | null, accept?: string) {
  const url = token === null
    ? "http://localhost/api/unsubscribe"
    : `http://localhost/api/unsubscribe?token=${token}`;
  return new NextRequest(url, { method, headers: accept ? { accept } : {} });
}

beforeEach(() => {
  state.db = makeDb();
});

describe("GET (read-only confirm page)", () => {
  it("404s on a missing or unknown token", async () => {
    expect((await GET(req("GET", null))).status).toBe(404);
    expect((await GET(req("GET", "unknown"))).status).toBe(404);
  });

  it("shows the confirm form WITHOUT suppressing (scanner-safe)", async () => {
    state.db = makeDb({ tables: { email_campaign_recipients: [{ data: RECIPIENT }] } });
    const res = await GET(req("GET", "tok-1"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<form method="post">');
    expect(state.db._inserts).toEqual([]);
  });
});

describe("POST (actual unsubscribe)", () => {
  it("404s on an unknown token without inserting", async () => {
    const res = await POST(req("POST", "unknown"));
    expect(res.status).toBe(404);
    expect(state.db._inserts).toEqual([]);
  });

  it("inserts a suppression on first unsubscribe", async () => {
    state.db = makeDb({
      tables: {
        email_campaign_recipients: [{ data: RECIPIENT }],
        email_suppressions: [{ data: null }], // not yet suppressed
      },
    });
    const res = await POST(req("POST", "tok-1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(state.db._inserts).toContainEqual({
      table: "email_suppressions",
      values: expect.objectContaining({ email: RECIPIENT.email, reason: "unsubscribe", source_campaign_id: "c1" }),
    });
  });

  it("is idempotent when the email is already suppressed", async () => {
    state.db = makeDb({
      tables: {
        email_campaign_recipients: [{ data: RECIPIENT }],
        email_suppressions: [{ data: { id: "sup1" } }], // already there
      },
    });
    const res = await POST(req("POST", "tok-1"));
    expect(res.status).toBe(200);
    expect(state.db._inserts).toEqual([]);
  });

  it("returns HTML to browsers and JSON to one-click callers", async () => {
    state.db = makeDb({
      tables: {
        email_campaign_recipients: [{ data: RECIPIENT }],
        email_suppressions: [{ data: null }],
      },
    });
    const html = await POST(req("POST", "tok-1", "text/html,application/xhtml+xml"));
    expect(html.headers.get("content-type")).toContain("text/html");
    expect(await html.text()).toContain("unsubscribed");
  });
});

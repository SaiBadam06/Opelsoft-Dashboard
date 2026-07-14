import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { makeDb } from "../../../../../test/fake-db";
import { POST } from "./route";

const state = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof import("../../../../../test/fake-db").makeDb> }));
const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({ createServiceClient: () => state.db }));
vi.mock("@/lib/email", () => ({ getSender: () => ({ send: sendMock }) }));

const SECRET = "test-drain-secret";

function drainRequest(secret?: string) {
  return new NextRequest("http://localhost/api/campaigns/drain", {
    method: "POST",
    headers: secret === undefined ? {} : { "x-drain-secret": secret },
  });
}

const CAMPAIGN = { id: "c1", subject: "Hi {{contact_name}}", body_html: "<p>Body</p>", from_address: "alex.smith@opelsoft.com", reply_to: null };

function recipient(attempts: number) {
  return { id: "r1", email: "john_doe@vendor.com", merge_data: {}, unsubscribe_token: "tok-1", attempts };
}

beforeEach(() => {
  process.env.EMAIL_DRAIN_SECRET = SECRET;
  process.env.APP_BASE_URL = "http://localhost:3000";
  state.db = makeDb();
  sendMock.mockReset();
});
afterEach(() => {
  delete process.env.EMAIL_DRAIN_SECRET;
});

describe("drain auth", () => {
  it("fails closed when EMAIL_DRAIN_SECRET is unset", async () => {
    delete process.env.EMAIL_DRAIN_SECRET;
    const res = await POST(drainRequest(""));
    expect(res.status).toBe(401);
  });

  it("rejects a wrong secret and a wrong-length secret", async () => {
    expect((await POST(drainRequest("nope"))).status).toBe(401);
    expect((await POST(drainRequest(SECRET + "-and-then-some"))).status).toBe(401);
    expect((await POST(drainRequest())).status).toBe(401);
  });

  it("accepts the correct secret (idle when no active campaign)", async () => {
    const res = await POST(drainRequest(SECRET));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ idle: true });
  });
});

describe("drain sending", () => {
  it("requeues stale 'sending' rows before claiming (reaper)", async () => {
    await POST(drainRequest(SECRET));
    expect(state.db._updates[0]).toMatchObject({
      table: "email_campaign_recipients",
      values: { status: "queued" },
    });
  });

  it("skips suppressed recipients without calling the sender", async () => {
    state.db = makeDb({
      tables: { email_campaigns: [{ data: CAMPAIGN }], email_suppressions: [{ data: { id: "sup1" } }] },
      rpcs: { email_sent_last_24h: [{ data: 0 }], claim_email_batch: [{ data: [recipient(1)] }] },
    });
    await POST(drainRequest(SECRET));
    expect(sendMock).not.toHaveBeenCalled();
    expect(state.db._updates).toContainEqual(
      expect.objectContaining({ table: "email_campaign_recipients", values: { status: "suppressed" } }),
    );
  });

  it("marks a recipient sent on success", async () => {
    state.db = makeDb({
      tables: { email_campaigns: [{ data: CAMPAIGN }] },
      rpcs: { email_sent_last_24h: [{ data: 0 }], claim_email_batch: [{ data: [recipient(1)] }] },
    });
    sendMock.mockResolvedValue({ id: "graph-msg-1" });
    const res = await POST(drainRequest(SECRET));
    expect(await res.json()).toMatchObject({ campaign: "c1", sent: 1, failed: 0 });
    expect(state.db._updates).toContainEqual(
      expect.objectContaining({
        table: "email_campaign_recipients",
        values: expect.objectContaining({ status: "sent", message_id: "graph-msg-1" }),
      }),
    );
  });

  it("requeues a retryable failure under the attempt cap", async () => {
    state.db = makeDb({
      tables: { email_campaigns: [{ data: CAMPAIGN }] },
      rpcs: { email_sent_last_24h: [{ data: 0 }], claim_email_batch: [{ data: [recipient(1)] }] },
    });
    sendMock.mockRejectedValue(Object.assign(new Error("boom"), { status: 500 }));
    await POST(drainRequest(SECRET));
    expect(state.db._updates).toContainEqual(
      expect.objectContaining({
        table: "email_campaign_recipients",
        values: expect.objectContaining({ status: "queued", last_error: "boom" }),
      }),
    );
  });

  it("fails a retryable error once attempts reach MAX_ATTEMPTS", async () => {
    state.db = makeDb({
      tables: { email_campaigns: [{ data: CAMPAIGN }] },
      rpcs: { email_sent_last_24h: [{ data: 0 }], claim_email_batch: [{ data: [recipient(5)] }] },
    });
    sendMock.mockRejectedValue(Object.assign(new Error("still down"), { status: 503 }));
    const res = await POST(drainRequest(SECRET));
    expect(await res.json()).toMatchObject({ failed: 1 });
    expect(state.db._updates).toContainEqual(
      expect.objectContaining({
        table: "email_campaign_recipients",
        values: expect.objectContaining({ status: "failed" }),
      }),
    );
  });

  it("fails a non-retryable error immediately", async () => {
    state.db = makeDb({
      tables: { email_campaigns: [{ data: CAMPAIGN }] },
      rpcs: { email_sent_last_24h: [{ data: 0 }], claim_email_batch: [{ data: [recipient(1)] }] },
    });
    sendMock.mockRejectedValue(Object.assign(new Error("bad address"), { status: 400 }));
    await POST(drainRequest(SECRET));
    expect(state.db._updates).toContainEqual(
      expect.objectContaining({
        table: "email_campaign_recipients",
        values: expect.objectContaining({ status: "failed" }),
      }),
    );
  });

  it("short-circuits when the daily cap is reached", async () => {
    state.db = makeDb({
      tables: { email_campaigns: [{ data: CAMPAIGN }] },
      rpcs: { email_sent_last_24h: [{ data: 800 }] },
    });
    const res = await POST(drainRequest(SECRET));
    expect(await res.json()).toEqual({ capped: true });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("waits (not done) while claimed rows are still in flight", async () => {
    state.db = makeDb({
      tables: {
        email_campaigns: [{ data: CAMPAIGN }],
        // countBy("sending") after the empty claim
        email_campaign_recipients: [{ count: 0 }, { count: 3 }],
      },
      rpcs: { email_sent_last_24h: [{ data: 0 }], claim_email_batch: [{ data: [] }] },
    });
    const res = await POST(drainRequest(SECRET));
    expect(await res.json()).toEqual({ waiting: "c1", sending: 3 });
    // Campaign must NOT have been marked done
    expect(state.db._updates).not.toContainEqual(
      expect.objectContaining({ table: "email_campaigns", values: { status: "done" } }),
    );
  });

  it("marks the campaign done when nothing is queued or in flight", async () => {
    state.db = makeDb({
      tables: {
        email_campaigns: [{ data: CAMPAIGN }],
        email_campaign_recipients: [{ count: 0 }, { count: 0 }],
      },
      rpcs: { email_sent_last_24h: [{ data: 0 }], claim_email_batch: [{ data: [] }] },
    });
    const res = await POST(drainRequest(SECRET));
    expect(await res.json()).toEqual({ done: "c1" });
    expect(state.db._updates).toContainEqual(
      expect.objectContaining({ table: "email_campaigns", values: { status: "done" } }),
    );
  });
});

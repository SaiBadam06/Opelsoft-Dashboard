import { it, expect, vi, beforeEach } from "vitest";
import { GraphSender, __resetTokenCacheForTests } from "./graph";

beforeEach(() => {
  process.env.MS_TENANT_ID = "t"; process.env.MS_CLIENT_ID = "c"; process.env.MS_CLIENT_SECRET = "s";
  __resetTokenCacheForTests();
});

it("acquires a token then POSTs sendMail with List-Unsubscribe as an extended property", async () => {
  const calls: Array<{ url: string; body: string }> = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
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

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
    signal: AbortSignal.timeout(15_000),
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
      signal: AbortSignal.timeout(15_000),
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

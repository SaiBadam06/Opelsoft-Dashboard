import { headers } from "next/headers";
import type { NextRequest } from "next/server";

/** Runtime site URL — do not rely on NEXT_PUBLIC_* (baked at build time). */
function fromEnv(): string | null {
  const url = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  return url ? url.replace(/\/$/, "") : null;
}

/** Cloud Run / reverse proxies may expose 0.0.0.0 or internal hosts — never use those. */
function isUsableHost(host: string): boolean {
  const h = host.split(":")[0].trim().toLowerCase();
  return h !== "0.0.0.0" && h !== "127.0.0.1" && h !== "localhost" && h !== "";
}

function fromHost(host: string | null, proto: string | null): string | null {
  if (!host) return null;
  const primary = host.split(",")[0].trim();
  if (!isUsableHost(primary)) return null;
  const scheme = proto?.split(",")[0]?.trim() || "http";
  return `${scheme}://${primary}`.replace(/\/$/, "");
}

/** For Route Handlers — prefer Host / X-Forwarded-* over request.url origin. */
export function siteUrlFromRequest(request: NextRequest): string {
  const fromHeaders = fromHost(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    request.headers.get("x-forwarded-proto"),
  );
  if (fromHeaders) return fromHeaders;

  const fromConfigured = fromEnv();
  if (fromConfigured) return fromConfigured;

  const fallback = new URL(request.url);
  if (isUsableHost(fallback.host)) return fallback.origin;

  return "http://localhost:3000";
}

/** For Server Actions — derive from incoming request headers. */
export async function getSiteUrl(): Promise<string> {
  const h = await headers();
  return (
    fromHost(
      h.get("x-forwarded-host") ?? h.get("host"),
      h.get("x-forwarded-proto"),
    ) ??
    fromEnv() ??
    "http://localhost:3000"
  );
}

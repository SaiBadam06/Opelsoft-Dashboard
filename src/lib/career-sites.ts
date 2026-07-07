import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export interface CareerSite {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  logo_url: string | null;
  primary_color: string | null;
  hero_headline: string | null;
  hero_subtext: string | null;
  is_active: boolean;
}

const SITE_COLUMNS =
  "id, slug, name, domain, logo_url, primary_color, hero_headline, hero_subtext, is_active";

function normalizeHost(host: string): string {
  const bare = host.split(":")[0].trim().toLowerCase();
  return bare.startsWith("www.") ? bare.slice(4) : bare;
}

function defaultSiteSlug(): string {
  return process.env.DEFAULT_CAREER_SITE_SLUG?.trim() || "opelsoft";
}

/** Dev/staging override from middleware (`?site=` query param). */
export async function getCareerSiteSlugOverride(): Promise<string | null> {
  const h = await headers();
  return h.get("x-career-site-slug");
}

/** Resolve host header for domain-based site lookup. */
export async function getRequestHost(): Promise<string | null> {
  const h = await headers();
  const raw = h.get("x-forwarded-host") ?? h.get("host");
  if (!raw) return null;
  const primary = raw.split(",")[0].trim();
  const normalized = normalizeHost(primary);
  if (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0"
  ) {
    return null;
  }
  return normalized;
}

export async function getCareerSiteBySlug(
  slug: string,
): Promise<CareerSite | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("career_sites")
    .select(SITE_COLUMNS)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return (data as CareerSite | null) ?? null;
}

export async function getCareerSiteByDomain(
  domain: string,
): Promise<CareerSite | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("career_sites")
    .select(SITE_COLUMNS)
    .eq("domain", domain)
    .eq("is_active", true)
    .maybeSingle();
  return (data as CareerSite | null) ?? null;
}

/**
 * Resolve the active career site for a public careers request.
 * 1. `?site=` override (dev/staging via middleware header)
 * 2. Host → career_sites.domain
 * 3. DEFAULT_CAREER_SITE_SLUG (localhost dev fallback)
 */
export async function resolveCareerSite(): Promise<CareerSite | null> {
  const override = await getCareerSiteSlugOverride();
  if (override) {
    return getCareerSiteBySlug(override);
  }

  const host = await getRequestHost();
  if (host) {
    const byDomain = await getCareerSiteByDomain(host);
    if (byDomain) return byDomain;
  }

  return getCareerSiteBySlug(defaultSiteSlug());
}

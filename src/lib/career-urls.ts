import type { CareerSite } from "@/lib/career-sites";

export function defaultCareerSiteSlug(): string {
  return process.env.DEFAULT_CAREER_SITE_SLUG?.trim() || "opelsoft";
}

/**
 * Append ?site= when the host won't resolve brand via career_sites.domain
 * (localhost, Cloud Run staging). Omit on custom marketing domains.
 */
export function withCareersSiteQuery(
  path: string,
  site: Pick<CareerSite, "slug" | "domain">,
): string {
  if (site.domain) return path;
  if (site.slug === defaultCareerSiteSlug()) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}site=${encodeURIComponent(site.slug)}`;
}

/** Build public careers list URL for admin preview links. */
export function buildCareersListUrl(
  site: Pick<CareerSite, "slug" | "domain">,
): string {
  if (site.domain) {
    return `https://${site.domain}/careers`;
  }
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  return withCareersSiteQuery(`${base}/careers`, site);
}

/** Build public careers job URL for dashboard "View on careers" links. */
export function buildCareersJobUrl(
  site: Pick<CareerSite, "slug" | "domain">,
  jobSlug: string,
): string {
  if (site.domain) {
    return `https://${site.domain}/careers/jobs/${jobSlug}`;
  }
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  return withCareersSiteQuery(`${base}/careers/jobs/${jobSlug}`, site);
}

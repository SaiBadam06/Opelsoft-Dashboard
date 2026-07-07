import type { CareerSite } from "@/lib/career-sites";

function defaultSiteSlug(): string {
  return process.env.DEFAULT_CAREER_SITE_SLUG?.trim() || "opelsoft";
}

/** Build public careers list URL for admin preview links. */
export function buildCareersListUrl(
  site: Pick<CareerSite, "slug" | "domain">,
  isDev = process.env.NODE_ENV === "development",
): string {
  if (!isDev && site.domain) {
    return `https://${site.domain}/careers`;
  }
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  const params =
    isDev && site.slug !== defaultSiteSlug()
      ? `?site=${encodeURIComponent(site.slug)}`
      : "";
  return `${base}/careers${params}`;
}

/** Build public careers job URL for dashboard "View on careers" links. */
export function buildCareersJobUrl(
  site: Pick<CareerSite, "slug" | "domain">,
  jobSlug: string,
  isDev = process.env.NODE_ENV === "development",
): string {
  if (!isDev && site.domain) {
    return `https://${site.domain}/careers/jobs/${jobSlug}`;
  }
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  const params =
    isDev && site.slug !== defaultSiteSlug()
      ? `?site=${encodeURIComponent(site.slug)}`
      : "";
  return `${base}/careers/jobs/${jobSlug}${params}`;
}

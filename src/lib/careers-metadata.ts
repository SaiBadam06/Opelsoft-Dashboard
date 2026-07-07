import type { Metadata } from "next";
import type { CareerSite } from "@/lib/career-sites";
import { buildCareersJobUrl, buildCareersListUrl } from "@/lib/career-urls";

function careersMetadataBase(site: CareerSite): URL {
  if (site.domain) {
    return new URL(`https://${site.domain}`);
  }
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  return new URL(base);
}

function ogImages(site: CareerSite): NonNullable<Metadata["openGraph"]>["images"] {
  if (!site.logo_url) return undefined;
  return [
    {
      url: site.logo_url,
      alt: `${site.name} logo`,
    },
  ];
}

/** Shared Open Graph + Twitter fields for careers list pages. */
export function careersListMetadata(site: CareerSite): Metadata {
  const title = `${site.name} Careers`;
  const description =
    site.hero_subtext ?? `Open positions at ${site.name}. Apply today.`;
  const url = buildCareersListUrl(site);

  return {
    metadataBase: careersMetadataBase(site),
    title,
    description,
    alternates: { canonical: "/careers" },
    openGraph: {
      title,
      description,
      type: "website",
      url,
      siteName: site.name,
      images: ogImages(site),
    },
    twitter: {
      card: site.logo_url ? "summary" : "summary_large_image",
      title,
      description,
      images: site.logo_url ? [site.logo_url] : undefined,
    },
  };
}

/** Shared Open Graph + Twitter fields for job detail pages. */
export function careersJobMetadata(
  site: CareerSite,
  job: { title: string; description: string | null; public_slug: string },
): Metadata {
  const title = `${job.title} — ${site.name} Careers`;
  const description =
    job.description?.slice(0, 160) ?? `${job.title} at ${site.name}`;
  const url = buildCareersJobUrl(site, job.public_slug);

  return {
    metadataBase: careersMetadataBase(site),
    title,
    description,
    alternates: { canonical: `/careers/jobs/${job.public_slug}` },
    openGraph: {
      title: `${job.title} — ${site.name}`,
      description,
      type: "website",
      url,
      siteName: site.name,
      images: ogImages(site),
    },
    twitter: {
      card: site.logo_url ? "summary" : "summary_large_image",
      title: `${job.title} — ${site.name}`,
      description,
      images: site.logo_url ? [site.logo_url] : undefined,
    },
  };
}

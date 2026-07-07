import Link from "next/link";
import type { CareerSite } from "@/lib/career-sites";

interface CareersSiteHeaderProps {
  site: CareerSite;
}

export function CareersSiteHeader({ site }: CareersSiteHeaderProps) {
  const headline = site.hero_headline ?? `Careers at ${site.name}`;
  const subtext =
    site.hero_subtext ?? "Explore open roles and join our team.";

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex items-center gap-3">
          {site.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={site.logo_url}
              alt={`${site.name} logo`}
              className="h-10 w-auto object-contain"
            />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: site.primary_color ?? "#2563eb" }}
            >
              {site.name.charAt(0)}
            </div>
          )}
          <Link
            href="/careers"
            className="text-lg font-semibold tracking-tight hover:underline"
          >
            {site.name}
          </Link>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {headline}
          </h1>
          <p className="max-w-2xl text-muted-foreground">{subtext}</p>
        </div>
      </div>
    </header>
  );
}

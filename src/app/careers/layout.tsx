import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { resolveCareerSite } from "@/lib/career-sites";
import { CareersSiteHeader } from "@/components/careers/careers-site-header";

export default async function CareersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const site = await resolveCareerSite();
  if (!site) notFound();

  const accent = site.primary_color ?? "#2563eb";

  return (
    <div
      className="min-h-full flex flex-col bg-background"
      style={{ "--career-accent": accent } as CSSProperties}
    >
      <CareersSiteHeader site={site} />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </div>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Powered by StaffingOS
      </footer>
    </div>
  );
}

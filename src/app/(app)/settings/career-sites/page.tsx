import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listAllCareerSites } from "@/lib/career-sites-admin";
import { CareerSiteEditor } from "./career-site-editor";

export default async function CareerSitesSettingsPage() {
  await requireAdmin();
  const sites = await listAllCareerSites();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Career sites</h1>
        <p className="text-sm text-muted-foreground">
          Manage branding for Opelsoft, Futurestack, Talent2Meet, and other
          public careers pages. Use{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            ?site=slug
          </code>{" "}
          on localhost to preview each brand. See{" "}
          <Link
            href="/settings/channels"
            className="text-primary underline-offset-4 hover:underline"
          >
            Distribution channels
          </Link>{" "}
          for LinkedIn, Indeed, and other board settings.
        </p>
      </div>

      <CareerSiteEditor sites={sites} />
    </div>
  );
}

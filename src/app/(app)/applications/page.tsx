import { requireProfile } from "@/lib/auth";
import { listAllCareerSites } from "@/lib/career-sites-admin";
import { listApplications } from "@/lib/job-applications";
import { ApplicationsTable } from "./applications-table";

export default async function ApplicationsPage() {
  await requireProfile();
  const [applications, sites] = await Promise.all([
    listApplications(),
    listAllCareerSites(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        <p className="text-sm text-muted-foreground">
          Inbound candidates from public careers pages
        </p>
      </div>

      <ApplicationsTable
        applications={applications}
        careerSites={sites.map((s) => ({ slug: s.slug, name: s.name }))}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveCareerSite } from "@/lib/career-sites";
import { careersListMetadata } from "@/lib/careers-metadata";
import { listPublicJobs } from "@/lib/job-postings";
import { CareersJobList } from "@/components/careers/careers-job-list";

export async function generateMetadata(): Promise<Metadata> {
  const site = await resolveCareerSite();
  if (!site) return { title: "Careers" };
  return careersListMetadata(site);
}

export default async function CareersPage() {
  const site = await resolveCareerSite();
  if (!site) notFound();

  const jobs = await listPublicJobs(site.id);

  return (
    <section>
      <h2 className="mb-6 text-xl font-semibold">
        Open positions
        {jobs.length > 0 ? (
          <span className="ml-2 text-base font-normal text-muted-foreground">
            ({jobs.length})
          </span>
        ) : null}
      </h2>
      <CareersJobList jobs={jobs} />
    </section>
  );
}

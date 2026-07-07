import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { CareersApplyForm } from "@/components/careers/careers-apply-form";
import { resolveCareerSite } from "@/lib/career-sites";
import { getPublicJob } from "@/lib/job-postings";

interface ApplyPageProps {
  params: Promise<{ jobSlug: string }>;
}

export async function generateMetadata({
  params,
}: ApplyPageProps): Promise<Metadata> {
  const { jobSlug } = await params;
  const site = await resolveCareerSite();
  if (!site) return { title: "Apply" };

  const job = await getPublicJob(site.id, jobSlug);
  if (!job) return { title: "Apply" };

  return {
    title: `Apply — ${job.title} — ${site.name}`,
    description: `Submit your application for ${job.title} at ${site.name}.`,
    robots: { index: false, follow: false },
  };
}

export default async function ApplyPage({ params }: ApplyPageProps) {
  const { jobSlug } = await params;
  const site = await resolveCareerSite();
  if (!site) notFound();

  const job = await getPublicJob(site.id, jobSlug);
  if (!job) notFound();

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/careers">Careers</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="min-w-0 max-w-[45%]">
            <BreadcrumbLink
              href={`/careers/jobs/${jobSlug}`}
              className="block truncate"
            >
              {job.title}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Apply</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <CareersApplyForm jobSlug={jobSlug} jobTitle={job.title} />
    </div>
  );
}

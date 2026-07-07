import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { buildBulletPoints } from "@/lib/career-jd";
import {
  workplaceBadgeClass,
  workplaceTypeLabel,
} from "@/lib/career-constants";
import { resolveCareerSite } from "@/lib/career-sites";
import { careersJobMetadata } from "@/lib/careers-metadata";
import { getPublicJob } from "@/lib/job-postings";

interface JobDetailPageProps {
  params: Promise<{ jobSlug: string }>;
}

export async function generateMetadata({
  params,
}: JobDetailPageProps): Promise<Metadata> {
  const { jobSlug } = await params;
  const site = await resolveCareerSite();
  if (!site) return { title: "Job" };

  const job = await getPublicJob(site.id, jobSlug);
  if (!job) return { title: "Job not found" };

  return careersJobMetadata(site, job);
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { jobSlug } = await params;
  const site = await resolveCareerSite();
  if (!site) notFound();

  const job = await getPublicJob(site.id, jobSlug);
  if (!job) notFound();

  const bullets = buildBulletPoints(job.description);
  const meta = [job.location, job.employment_type].filter(Boolean).join(" · ");

  return (
    <article className="space-y-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/careers">Careers</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{job.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{job.title}</h1>
          <Badge
            variant="outline"
            className={workplaceBadgeClass(job.workplace_type)}
          >
            {workplaceTypeLabel(job.workplace_type)}
          </Badge>
        </div>
        {meta ? <p className="text-muted-foreground">{meta}</p> : null}
        {job.skills ? (
          <p className="text-sm">
            <span className="font-medium">Skills: </span>
            {job.skills}
          </p>
        ) : null}
      </header>

      {bullets.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">About the role</h2>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            {bullets.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </section>
      ) : job.description ? (
        <section className="prose prose-sm max-w-none text-muted-foreground">
          <p className="whitespace-pre-wrap">{job.description}</p>
        </section>
      ) : null}

      <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:flex-wrap">
        <Button
          className="min-h-11 w-full sm:w-auto"
          render={<Link href={`/careers/jobs/${jobSlug}/apply`} />}
        >
          Apply for this role
        </Button>
        <Button
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          render={<Link href="/careers" />}
        >
          Back to all jobs
        </Button>
      </div>
    </article>
  );
}

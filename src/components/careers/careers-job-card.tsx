import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  workplaceBadgeClass,
  workplaceTypeLabel,
} from "@/lib/career-constants";
import type { CareerSite } from "@/lib/career-sites";
import { withCareersSiteQuery } from "@/lib/career-urls";
import type { PublicJobListItem } from "@/lib/job-postings";
import { ArrowRight } from "lucide-react";

interface CareersJobCardProps {
  job: PublicJobListItem;
  site: Pick<CareerSite, "slug" | "domain">;
}

export function CareersJobCard({ job, site }: CareersJobCardProps) {
  const meta = [job.location, job.employment_type].filter(Boolean).join(" · ");

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-lg">{job.title}</CardTitle>
          <Badge
            variant="outline"
            className={workplaceBadgeClass(job.workplace_type)}
          >
            {workplaceTypeLabel(job.workplace_type)}
          </Badge>
        </div>
        {meta ? (
          <p className="text-sm text-muted-foreground">{meta}</p>
        ) : null}
      </CardHeader>
      {job.skills ? (
        <CardContent className="pt-0">
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {job.skills}
          </p>
        </CardContent>
      ) : null}
      <CardContent className="pt-0">
        <Link
          href={withCareersSiteQuery(`/careers/jobs/${job.public_slug}`, site)}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View role
          <ArrowRight className="size-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CareersJobCard } from "@/components/careers/careers-job-card";
import type { PublicJobListItem } from "@/lib/job-postings";

interface CareersJobListProps {
  jobs: PublicJobListItem[];
}

function matchesQuery(job: PublicJobListItem, q: string): boolean {
  const haystack = [job.title, job.location, job.skills, job.employment_type]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function CareersJobList({ jobs }: CareersJobListProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((job) => matchesQuery(job, q));
  }, [jobs, query]);

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search jobs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
          aria-label="Search jobs"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-12 text-center">
          <p className="font-medium">
            {jobs.length === 0
              ? "No open positions right now"
              : "No jobs match your search"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {jobs.length === 0
              ? "Check back soon — we're always growing."
              : "Try different keywords or clear the search."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((job) => (
            <CareersJobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}

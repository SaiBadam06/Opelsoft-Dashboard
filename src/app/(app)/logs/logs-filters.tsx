"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SUBMISSION_STATUSES } from "@/lib/job-constants";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface CandidateOption {
  id: string;
  full_name: string;
}

export function LogsFilters({
  candidates,
}: {
  candidates: CandidateOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all" || !value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleClear = () => {
    router.push(pathname);
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Candidate
        </label>
        <Select
          value={searchParams.get("candidate") || "all"}
          onValueChange={(val) => handleFilter("candidate", val)}
        >
          <SelectTrigger>
            <SelectValue placeholder="All candidates" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All candidates</SelectItem>
            {candidates.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Status
        </label>
        <Select
          value={searchParams.get("status") || "all"}
          onValueChange={(val) => handleFilter("status", val)}
        >
          <SelectTrigger>
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {SUBMISSION_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          From Date
        </label>
        <Input
          type="date"
          value={searchParams.get("from") || ""}
          onChange={(e) => handleFilter("from", e.target.value)}
        />
      </div>

      <div className="flex-1 space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          To Date
        </label>
        <Input
          type="date"
          value={searchParams.get("to") || ""}
          onChange={(e) => handleFilter("to", e.target.value)}
        />
      </div>

      <div className="pb-[1px]">
        <Button variant="outline" onClick={handleClear} className="w-full sm:w-auto">
          Clear Filters
        </Button>
      </div>
    </div>
  );
}

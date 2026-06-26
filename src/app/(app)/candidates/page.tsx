import Link from "next/link";
import { Plus } from "lucide-react";

import { listCandidates } from "@/lib/candidates";
import { Button } from "@/components/ui/button";
import { CandidatesTable } from "./candidates-table";

export default async function CandidatesPage() {
  const candidates = await listCandidates();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
          <p className="text-sm text-muted-foreground">Your bench talent</p>
        </div>
        <Button render={<Link href="/candidates/new" />}>
          <Plus />
          Add candidate
        </Button>
      </div>

      <CandidatesTable candidates={candidates} />
    </div>
  );
}

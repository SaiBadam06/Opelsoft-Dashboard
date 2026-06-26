import Link from "next/link";
import { Plus } from "lucide-react";

import { listCandidates, listCoordinators } from "@/lib/candidates";
import { requireProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { CandidatesTable } from "./candidates-table";
import { ImportCandidatesButton } from "./import-candidates-button";

export default async function CandidatesPage() {
  const me = await requireProfile();
  const isAdmin = me.role === "admin";
  const [candidates, coordinators] = await Promise.all([
    listCandidates(),
    isAdmin ? listCoordinators() : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
          <p className="text-sm text-muted-foreground">Your bench talent</p>
        </div>
        <div className="flex items-center gap-2">
          <ImportCandidatesButton />
          <Button render={<Link href="/candidates/new" />}>
            <Plus />
            Add candidate
          </Button>
        </div>
      </div>

      <CandidatesTable
        candidates={candidates}
        coordinators={coordinators}
        isAdmin={isAdmin}
      />
    </div>
  );
}

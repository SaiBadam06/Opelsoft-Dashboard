import Link from "next/link";
import { Plus } from "lucide-react";

import { requireProfile } from "@/lib/auth";
import { listSubmissions } from "@/lib/submissions";
import { Button } from "@/components/ui/button";
import { SubmissionsTable } from "./submissions-table";

export default async function SubmissionsPage() {
  const me = await requireProfile();
  const subs = await listSubmissions();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Submissions</h1>
          <p className="text-sm text-muted-foreground">
            Candidates submitted to requirements
          </p>
        </div>
        <Button render={<Link href="/submissions/new" />}>
          <Plus />
          New submission
        </Button>
      </div>

      <SubmissionsTable submissions={subs} isAdmin={me.role === "admin"} />
    </div>
  );
}

import Link from "next/link";
import { Plus } from "lucide-react";

import { requireProfile } from "@/lib/auth";
import { listInterviews } from "@/lib/interviews";
import { Button } from "@/components/ui/button";
import { InterviewsTable } from "./interviews-table";

export default async function InterviewsPage() {
  const me = await requireProfile();
  const rows = await listInterviews();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Interviews</h1>
          <p className="text-sm text-muted-foreground">
            Scheduled and completed interviews
          </p>
        </div>
        <Button render={<Link href="/interviews/new" />}>
          <Plus />
          Log interview
        </Button>
      </div>

      <InterviewsTable interviews={rows} isAdmin={me.role === "admin"} />
    </div>
  );
}

import Link from "next/link";
import { Plus, Mail } from "lucide-react";

import { requireProfile } from "@/lib/auth";
import { listRequirements } from "@/lib/requirements";
import { Button } from "@/components/ui/button";
import { RequirementsTable } from "./requirements-table";

export default async function RequirementsPage() {
  const me = await requireProfile();
  const reqs = await listRequirements();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Requirements</h1>
          <p className="text-sm text-muted-foreground">
            Open roles from your vendors
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            render={<Link href="/requirements/intake" />}
          >
            <Mail />
            Intake from email
          </Button>
          <Button render={<Link href="/requirements/new" />}>
            <Plus />
            Add requirement
          </Button>
        </div>
      </div>

      <RequirementsTable requirements={reqs} isAdmin={me.role === "admin"} />
    </div>
  );
}

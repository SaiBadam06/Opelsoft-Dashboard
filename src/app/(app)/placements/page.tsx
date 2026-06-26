import Link from "next/link";
import { Plus } from "lucide-react";

import { requireProfile } from "@/lib/auth";
import { listPlacements } from "@/lib/placements";
import { Button } from "@/components/ui/button";
import { PlacementsTable } from "./placements-table";
import { ImportPlacementsButton } from "./import-placements-button";

export default async function PlacementsPage() {
  const me = await requireProfile();
  const rows = await listPlacements();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Placements</h1>
          <p className="text-sm text-muted-foreground">
            Consultants placed on projects
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportPlacementsButton />
          <Button render={<Link href="/placements/new" />}>
            <Plus />
            Add placement
          </Button>
        </div>
      </div>

      <PlacementsTable placements={rows} isAdmin={me.role === "admin"} />
    </div>
  );
}

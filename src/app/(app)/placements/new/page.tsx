import { candidateOptions } from "@/lib/candidates";
import { vendorOptions } from "@/lib/vendors";
import { PlacementForm } from "../placement-form";

export default async function NewPlacementPage() {
  const [candidates, vendors] = await Promise.all([
    candidateOptions(),
    vendorOptions(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Add placement</h1>
        <p className="text-sm text-muted-foreground">
          Record a consultant placed on a project
        </p>
      </div>

      <PlacementForm candidates={candidates} vendors={vendors} />
    </div>
  );
}

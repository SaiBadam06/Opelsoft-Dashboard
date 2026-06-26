import { vendorOptions } from "@/lib/vendors";
import { RequirementForm } from "../requirement-form";

export default async function NewRequirementPage() {
  const vendors = await vendorOptions();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          New requirement
        </h1>
        <p className="text-sm text-muted-foreground">
          Add an open role from a vendor.
        </p>
      </div>

      <RequirementForm vendors={vendors} />
    </div>
  );
}

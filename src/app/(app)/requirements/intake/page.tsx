import { vendorOptions } from "@/lib/vendors";
import { IntakeClient } from "./intake-client";

export const dynamic = "force-dynamic";

export default async function RequirementIntakePage() {
  const vendors = await vendorOptions();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Requirement intake
        </h1>
        <p className="text-sm text-muted-foreground">
          Paste a vendor email — AI extracts the requirement for you to review.
        </p>
      </div>

      <IntakeClient vendors={vendors} />
    </div>
  );
}

import { notFound } from "next/navigation";

import { getRequirement } from "@/lib/requirements";
import { vendorOptions } from "@/lib/vendors";
import { RequirementForm } from "../../requirement-form";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await getRequirement(id);
  if (!r) notFound();
  const vendors = await vendorOptions();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit requirement
        </h1>
        <p className="text-sm text-muted-foreground">{r.title}</p>
      </div>

      <RequirementForm requirement={r} vendors={vendors} />
    </div>
  );
}

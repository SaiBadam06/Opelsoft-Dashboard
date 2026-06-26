import { notFound } from "next/navigation";

import { getVendor } from "@/lib/vendors";
import { VendorForm } from "@/app/(app)/vendors/vendor-form";

export default async function EditVendorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vendor = await getVendor(id);
  if (!vendor) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Edit vendor</h1>
        <p className="text-sm text-muted-foreground">
          Update this vendor&apos;s details.
        </p>
      </div>
      <VendorForm vendor={vendor} />
    </div>
  );
}

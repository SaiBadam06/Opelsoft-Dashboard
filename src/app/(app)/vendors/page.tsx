import Link from "next/link";
import { Plus } from "lucide-react";

import { requireProfile } from "@/lib/auth";
import { listVendors } from "@/lib/vendors";
import { Button } from "@/components/ui/button";
import { VendorsTable } from "./vendors-table";
import { ImportVendorsButton } from "./import-vendors-button";

export default async function VendorsPage() {
  const me = await requireProfile();
  const vendors = await listVendors();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Vendors</h1>
          <p className="text-sm text-muted-foreground">
            Companies that provide your job requirements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportVendorsButton />
          <Button render={<Link href="/vendors/new" />}>
            <Plus />
            Add vendor
          </Button>
        </div>
      </div>

      <VendorsTable vendors={vendors} isAdmin={me.role === "admin"} />
    </div>
  );
}

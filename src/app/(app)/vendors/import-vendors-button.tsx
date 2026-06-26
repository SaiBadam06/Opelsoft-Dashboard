"use client";

import { ImportDialog } from "@/components/import-dialog";
import { importVendors } from "./import-actions";

export function ImportVendorsButton() {
  return (
    <ImportDialog
      title="Import vendors"
      description="Upload your vendor list (.xlsx or .csv)."
      columnsHint="Columns: Name, Contact Name, Email, Phone, Notes"
      action={importVendors}
    />
  );
}

export default ImportVendorsButton;

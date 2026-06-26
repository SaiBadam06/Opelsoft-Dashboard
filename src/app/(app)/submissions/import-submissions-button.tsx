"use client";

import { ImportDialog } from "@/components/import-dialog";
import { importSubmissions } from "./import-actions";

export function ImportSubmissionsButton() {
  return (
    <ImportDialog
      title="Import submissions"
      description="Upload your submissions sheet."
      columnsHint="Columns: Consultant Name, Rate, Vendor, Client, Prime/Layer, Submission status, Date"
      action={importSubmissions}
    />
  );
}

export default ImportSubmissionsButton;

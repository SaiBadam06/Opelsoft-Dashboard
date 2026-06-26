"use client";

import { ImportDialog } from "@/components/import-dialog";
import { importCandidates } from "./import-actions";

export function ImportCandidatesButton() {
  return (
    <ImportDialog
      title="Import candidates"
      description="Upload your bench list (.xlsx or .csv)."
      columnsHint="Columns: Consultant Name, Technology, Yrs of Exp, Location, Relocation, Visa, Rate, Contact Number, Email ID, Comments"
      action={importCandidates}
    />
  );
}

export default ImportCandidatesButton;

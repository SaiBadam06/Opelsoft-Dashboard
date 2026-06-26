"use client";

import { ImportDialog } from "@/components/import-dialog";
import { importPlacements } from "./import-actions";

export function ImportPlacementsButton() {
  return (
    <ImportDialog
      title="Import placements"
      description="Upload your placements sheet."
      columnsHint="Columns: Consultant Name, Recruiter, OPT Recruiter, Vendor, Client, New/Exp, Rate, Placement date, Project Start Date, BGV and Date, In/Out, Project End Date, Feedback"
      action={importPlacements}
    />
  );
}

export default ImportPlacementsButton;

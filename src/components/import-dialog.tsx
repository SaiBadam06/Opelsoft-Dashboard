"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RowError = { row: number; field: string; issue: string };

type ImportResult =
  | { ok: true; inserted: number; skipped: number; duplicates?: number }
  | { error: string; rowErrors?: RowError[] };

type ImportDialogProps = {
  title: string;
  description: string;
  columnsHint: string;
  action: (rows: Record<string, unknown>[]) => Promise<ImportResult>;
};

export function ImportDialog({
  title,
  description,
  columnsHint,
  action,
}: ImportDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [rowErrors, setRowErrors] = React.useState<RowError[]>([]);
  const [isPending, startTransition] = React.useTransition();

  function reset() {
    setRows([]);
    setFileName(null);
    setRowErrors([]);
  }

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) { reset(); return; }
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const parsed = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
        raw: false,
      }) as Record<string, unknown>[];
      setRows(parsed);
      setFileName(file.name);
      setRowErrors([]);
    } catch {
      reset();
      toast.error("Could not read that file. Please upload a valid .xlsx or .csv.");
    }
  }

  function onImport() {
    startTransition(async () => {
      const result = await action(rows);
      if ("error" in result) {
        if (result.rowErrors && result.rowErrors.length > 0) {
          setRowErrors(result.rowErrors);
        } else {
          toast.error(result.error);
        }
        return;
      }
      const parts = [`Imported ${result.inserted}`];
      if (result.duplicates) parts.push(`${result.duplicates} duplicate(s) skipped`);
      if (result.skipped) parts.push(`${result.skipped} row(s) skipped`);
      toast.success(parts.join(" · "));
      router.refresh();
      setOpen(false);
    });
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Upload />
            Import
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">{columnsHint}</p>

          <div className="flex flex-col gap-2">
            <Label htmlFor="import-file">File</Label>
            <Input
              id="import-file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={onFileChange}
              disabled={isPending}
            />
          </div>

          {fileName && rowErrors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Found {rows.length} {rows.length === 1 ? "row" : "rows"}
            </p>
          ) : null}

          {rowErrors.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertCircle className="size-4" />
                {rowErrors.length} validation {rowErrors.length === 1 ? "error" : "errors"} — fix your file and re-upload
              </div>
              <ul className="max-h-48 overflow-y-auto rounded-md border bg-destructive/5 px-3 py-2 text-xs text-destructive space-y-1">
                {rowErrors.map((e, i) => (
                  <li key={i}>
                    Row {e.row} · <span className="font-medium">{e.field}</span>: {e.issue}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />} disabled={isPending}>
            Cancel
          </DialogClose>
          <Button
            onClick={onImport}
            disabled={rows.length === 0 || isPending || rowErrors.length > 0}
          >
            <Upload />
            Import {rows.length} {rows.length === 1 ? "row" : "rows"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImportDialog;

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
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

type ImportResult =
  | { ok: true; inserted: number; skipped: number }
  | { error: string };

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
  const [isPending, startTransition] = React.useTransition();

  function reset() {
    setRows([]);
    setFileName(null);
  }

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      reset();
      return;
    }

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
    } catch {
      reset();
      toast.error("Could not read that file. Please upload a valid .xlsx or .csv.");
    }
  }

  function onImport() {
    startTransition(async () => {
      const result = await action(rows);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Imported ${result.inserted}, skipped ${result.skipped}`
      );
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
      <DialogContent>
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

          {fileName ? (
            <p className="text-sm text-muted-foreground">
              Found {rows.length} {rows.length === 1 ? "row" : "rows"}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />} disabled={isPending}>
            Cancel
          </DialogClose>
          <Button onClick={onImport} disabled={rows.length === 0 || isPending}>
            <Upload />
            Import {rows.length} {rows.length === 1 ? "row" : "rows"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImportDialog;

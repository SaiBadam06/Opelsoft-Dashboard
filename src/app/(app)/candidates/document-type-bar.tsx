"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/documents";

// Segmented "folder" bar replacing the doc-type dropdown.
export function DocumentTypeBar({
  value,
  onChange,
  disabled,
}: {
  value: DocumentType;
  onChange: (t: DocumentType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
      {DOCUMENT_TYPES.map((d) => (
        <Button
          key={d.value}
          type="button"
          size="sm"
          variant={value === d.value ? "default" : "ghost"}
          disabled={disabled}
          onClick={() => onChange(d.value)}
          className={cn("h-8", value === d.value ? "" : "text-muted-foreground")}
        >
          {d.label}
        </Button>
      ))}
    </div>
  );
}

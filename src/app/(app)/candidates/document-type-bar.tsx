"use client";

import { cn } from "@/lib/utils";
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/documents";

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
    <div className="inline-flex flex-wrap gap-1 rounded-md border bg-muted/40 p-1">
      {DOCUMENT_TYPES.map((d) => (
        <button
          key={d.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(d.value)}
          className={cn(
            "rounded px-3 py-1 text-sm transition-colors disabled:opacity-50",
            value === d.value
              ? "bg-background font-medium shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}

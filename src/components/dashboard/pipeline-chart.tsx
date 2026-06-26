"use client";

import { cn } from "@/lib/utils";
import type { StageCount } from "@/lib/dashboard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PipelineChart({
  data,
  className,
}: {
  data: StageCount[];
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const hasAny = data.some((d) => d.count > 0);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Candidate Pipeline</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!hasAny ? (
          <p className="text-sm text-muted-foreground">No candidates yet.</p>
        ) : (
          data.map((stage) => (
            <div key={stage.stage} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate text-sm">
                {stage.label}
              </span>
              <div className="h-2 flex-1 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${(stage.count / max) * 100}%` }}
                />
              </div>
              <span className={cn("w-8 shrink-0 text-right text-sm tabular-nums")}>
                {stage.count}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

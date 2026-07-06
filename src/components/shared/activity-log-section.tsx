import { type ActivityLog } from "@/lib/activity";
import { formatDateTime } from "@/lib/format";
import { Activity } from "lucide-react";

export function ActivityLogSection({ logs }: { logs: ActivityLog[] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No activity yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4 relative">
      <div className="absolute left-3 top-2 bottom-2 w-px bg-border/60"></div>
      {logs.map((log) => (
        <div key={log.id} className="flex gap-4 relative">
          <div className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-muted border border-border/50 shrink-0">
            <Activity className="h-3 w-3 text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-1 pt-[2px]">
            <p className="text-sm text-foreground">
              <span className="font-semibold">{log.actor_name || "System"}</span>{" "}
              {log.action.toLowerCase()}
            </p>
            <p className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}</p>
            
            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <div className="mt-1 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground/80">
                {Object.entries(log.metadata).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="font-medium capitalize">{key.replace(/_/g, " ")}:</span>
                    <span>{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

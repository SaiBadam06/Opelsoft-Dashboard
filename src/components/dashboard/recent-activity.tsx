import {
  Award,
  CalendarClock,
  Send,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { ActivityItem } from "@/lib/dashboard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const KIND_META: Record<
  ActivityItem["kind"],
  { icon: LucideIcon; chip: string }
> = {
  candidate: { icon: UserPlus, chip: "bg-info text-info-foreground" },
  submission: { icon: Send, chip: "bg-brand text-primary-foreground" },
  interview: { icon: CalendarClock, chip: "bg-warning text-warning-foreground" },
  placement: { icon: Award, chip: "bg-success text-success-foreground" },
};

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          items.map((item) => {
            const { icon: Icon, chip } = KIND_META[item.kind];
            return (
              <div key={item.id} className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    chip,
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">{item.title}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {item.detail}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(item.at)}
                </span>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

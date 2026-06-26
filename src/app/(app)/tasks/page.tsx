import Link from "next/link";
import { Plus } from "lucide-react";

import { requireProfile } from "@/lib/auth";
import { listTasks } from "@/lib/tasks";
import { Button } from "@/components/ui/button";
import { TasksTable } from "./tasks-table";

export default async function TasksPage() {
  const me = await requireProfile();
  const rows = await listTasks();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Reminders and follow-ups
          </p>
        </div>
        <Button render={<Link href="/tasks/new" />}>
          <Plus />
          Add task
        </Button>
      </div>

      <TasksTable tasks={rows} isAdmin={me.role === "admin"} />
    </div>
  );
}

import { candidateOptions, listCoordinators } from "@/lib/candidates";
import { TaskForm } from "../task-form";

export default async function NewTaskPage() {
  const [candidates, coordinators] = await Promise.all([
    candidateOptions(),
    listCoordinators(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Add task</h1>
        <p className="text-sm text-muted-foreground">
          Create a reminder or follow-up
        </p>
      </div>

      <TaskForm candidates={candidates} coordinators={coordinators} />
    </div>
  );
}

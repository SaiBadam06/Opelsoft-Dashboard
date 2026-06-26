import { createClient } from "@/lib/supabase/server";
import type { TaskStatus, TaskType } from "@/lib/work-constants";

export interface Task {
  id: string;
  title: string;
  type: TaskType;
  candidate_id: string | null;
  assigned_to: string | null;
  due_date: string | null;
  status: TaskStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskRow extends Task {
  candidate_name: string | null;
  assignee_name: string | null;
}

const COLUMNS =
  "id, title, type, candidate_id, assigned_to, due_date, status, notes, created_at, updated_at";

type Joined = Task & {
  candidates: { full_name: string } | null;
  profiles: { full_name: string | null; email: string } | null;
};

export async function listTasks(): Promise<TaskRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select(
      `${COLUMNS}, candidates(full_name), profiles!tasks_assigned_to_fkey(full_name, email)`,
    )
    // 'pending' sorts before 'done' (descending puts pending first)
    .order("status", { ascending: false })
    .order("due_date", { ascending: true, nullsFirst: false });
  return ((data as unknown as Joined[] | null) ?? []).map((t) => ({
    ...t,
    candidate_name: t.candidates?.full_name ?? null,
    assignee_name: t.profiles?.full_name ?? t.profiles?.email ?? null,
  }));
}

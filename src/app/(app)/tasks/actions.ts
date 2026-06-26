"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { sendMail } from "@/lib/mail";
import { taskTypeLabel, type TaskStatus, type TaskType } from "@/lib/work-constants";

function str(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
}

export async function createTask(_prev: unknown, fd: FormData) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const title = String(fd.get("title") ?? "").trim();
  if (!title) return { error: "Title is required." };

  const type = (str(fd, "type") ?? "follow_up") as TaskType;
  const assignedTo = str(fd, "assigned_to") ?? me.id;
  const dueDate = str(fd, "due_date");

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    title,
    type,
    candidate_id: str(fd, "candidate_id"),
    assigned_to: assignedTo,
    due_date: dueDate,
    status: (str(fd, "status") ?? "pending") as TaskStatus,
    notes: str(fd, "notes"),
    created_by: me.id,
  });
  if (error) return { error: error.message };

  // Notify the assignee by email (skip self-assignment).
  if (assignedTo !== me.id) {
    const { data: assignee } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", assignedTo)
      .single();
    if (assignee?.email) {
      await sendMail({
        to: assignee.email,
        subject: `New task assigned: ${title}`,
        text: `Hi ${assignee.full_name ?? "there"},

${me.full_name ?? "A teammate"} assigned you a task on the OpelSoft dashboard.

Task: ${title}
Type: ${taskTypeLabel(type)}${dueDate ? `\nDue: ${dueDate}` : ""}

Open the dashboard to view details.`,
      });
    }
  }

  revalidatePath("/tasks");
  redirect("/tasks");
}

export async function setTaskStatus(id: string, status: TaskStatus) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { ok: true as const };
}

export async function deleteTask(id: string) {
  const me = await getCurrentProfile();
  if (me?.role !== "admin") return { error: "Only admins can delete." };
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { ok: true as const };
}

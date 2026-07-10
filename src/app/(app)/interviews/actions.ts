"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { syncCandidateStage } from "@/lib/pipeline-sync.server";
import type { InterviewResult } from "@/lib/work-constants";

function str(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
}

export async function createInterview(_prev: unknown, fd: FormData) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const candidate_id = str(fd, "candidate_id");
  if (!candidate_id) return { error: "Pick a candidate." };

  const supabase = await createClient();
  const { error } = await supabase.from("interviews").insert({
    candidate_id,
    requirement_id: str(fd, "requirement_id"),
    end_client: str(fd, "end_client"),
    round: str(fd, "round"),
    interview_date: str(fd, "interview_date"),
    mode: str(fd, "mode"),
    interviewer: str(fd, "interviewer"),
    feedback: str(fd, "feedback"),
    result: (str(fd, "result") ?? "scheduled") as InterviewResult,
    created_by: me.id,
  });
  if (error) return { error: error.message };
  await syncCandidateStage(supabase, candidate_id, me.id);
  revalidatePath("/interviews");
  revalidatePath("/pipeline");
  revalidatePath("/candidates");
  revalidatePath("/dashboard");
  redirect("/interviews");
}

export async function setInterviewResult(id: string, result: InterviewResult) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interviews")
    .update({ result })
    .eq("id", id)
    .select("candidate_id")
    .single();
  if (error) return { error: error.message };
  if (data?.candidate_id) {
    await syncCandidateStage(supabase, data.candidate_id, me.id);
  }
  revalidatePath("/interviews");
  revalidatePath("/pipeline");
  revalidatePath("/candidates");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function setInterviewRound(id: string, round: string | null) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interviews")
    .update({ round })
    .eq("id", id)
    .select("candidate_id")
    .single();
  if (error) return { error: error.message };
  if (data?.candidate_id) {
    await syncCandidateStage(supabase, data.candidate_id, me.id);
  }
  revalidatePath("/interviews");
  revalidatePath("/pipeline");
  revalidatePath("/candidates");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function deleteInterview(id: string) {
  const me = await getCurrentProfile();
  if (me?.role !== "admin") return { error: "Only admins can delete." };
  const supabase = await createClient();
  const { error } = await supabase.from("interviews").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/interviews");
  return { ok: true as const };
}

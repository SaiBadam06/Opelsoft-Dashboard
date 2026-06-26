import { createClient } from "@/lib/supabase/server";
import { PIPELINE_STAGES, stageLabel } from "@/lib/candidate-constants";

export interface DashboardMetrics {
  totalCandidates: number;
  activeCandidates: number;
  activeRequirements: number;
  recruiters: number;
  interviewsToday: number;
  placements: number;
  pendingFollowups: number;
  submissionsToday: number;
  offersReleased: number;
  rejected: number;
}

async function cnt(q: PromiseLike<{ count: number | null }>): Promise<number> {
  const { count } = await q;
  return count ?? 0;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const head = (t: string) =>
    supabase.from(t).select("*", { count: "exact", head: true });

  const [
    totalCandidates,
    activeCandidates,
    activeRequirements,
    recruiters,
    interviewsToday,
    placements,
    pendingFollowups,
    submissionsToday,
    offersReleased,
    rejected,
  ] = await Promise.all([
    cnt(head("candidates")),
    cnt(
      head("candidates").in("status", [
        "available",
        "interviewing",
        "submitted",
        "offered",
      ]),
    ),
    cnt(head("requirements").eq("status", "open")),
    cnt(head("profiles")),
    cnt(
      head("interviews")
        .gte("interview_date", today)
        .lt("interview_date", tomorrow),
    ),
    cnt(head("placements")),
    cnt(head("tasks").eq("status", "pending")),
    cnt(head("submissions").eq("submitted_date", today)),
    cnt(head("submissions").eq("status", "offer")),
    cnt(head("candidates").eq("status", "rejected")),
  ]);

  return {
    totalCandidates,
    activeCandidates,
    activeRequirements,
    recruiters,
    interviewsToday,
    placements,
    pendingFollowups,
    submissionsToday,
    offersReleased,
    rejected,
  };
}

export interface ActivityItem {
  id: string;
  kind: "candidate" | "submission" | "interview" | "placement";
  title: string;
  detail: string;
  at: string;
}

export async function getRecentActivity(): Promise<ActivityItem[]> {
  const supabase = await createClient();
  const [cands, subs, ints, places] = await Promise.all([
    supabase
      .from("candidates")
      .select("id, full_name, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("submissions")
      .select("id, created_at, candidates(full_name)")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("interviews")
      .select("id, created_at, candidates(full_name)")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("placements")
      .select("id, created_at, candidates(full_name)")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const name = (row: { candidates?: { full_name?: string } | null }) =>
    row.candidates?.full_name ?? "a candidate";

  const items: ActivityItem[] = [
    ...((cands.data as { id: string; full_name: string; created_at: string }[] | null) ?? []).map(
      (c) => ({
        id: `c-${c.id}`,
        kind: "candidate" as const,
        title: "Candidate added",
        detail: c.full_name,
        at: c.created_at,
      }),
    ),
    ...(((subs.data as unknown as { id: string; created_at: string; candidates: { full_name: string } | null }[] | null) ?? []).map(
      (s) => ({
        id: `s-${s.id}`,
        kind: "submission" as const,
        title: "Candidate submitted",
        detail: name(s),
        at: s.created_at,
      }),
    )),
    ...(((ints.data as unknown as { id: string; created_at: string; candidates: { full_name: string } | null }[] | null) ?? []).map(
      (i) => ({
        id: `i-${i.id}`,
        kind: "interview" as const,
        title: "Interview logged",
        detail: name(i),
        at: i.created_at,
      }),
    )),
    ...(((places.data as unknown as { id: string; created_at: string; candidates: { full_name: string } | null }[] | null) ?? []).map(
      (p) => ({
        id: `p-${p.id}`,
        kind: "placement" as const,
        title: "Placement recorded",
        detail: name(p),
        at: p.created_at,
      }),
    )),
  ];

  return items.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 8);
}

export interface StageCount {
  stage: string;
  label: string;
  count: number;
}

export async function getPipelineDistribution(): Promise<StageCount[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("candidates").select("pipeline_stage");
  const rows = (data as { pipeline_stage: string }[] | null) ?? [];
  const counts = new Map<string, number>();
  for (const r of rows) {
    counts.set(r.pipeline_stage, (counts.get(r.pipeline_stage) ?? 0) + 1);
  }
  return PIPELINE_STAGES.map((s) => ({
    stage: s.value,
    label: stageLabel(s.value),
    count: counts.get(s.value) ?? 0,
  }));
}

import { createClient } from "@/lib/supabase/server";

export interface ActivityLog {
  id: string;
  candidate_id: string | null;
  requirement_id: string | null;
  submission_id: string | null;
  vendor_id: string | null;
  action: string;
  actor_id: string | null;
  actor_name: string | null;
  metadata: any;
  created_at: string;
}

export type EntityType = "candidate" | "requirement" | "submission" | "vendor";

function getEntityColumn(entityType: EntityType): string {
  switch (entityType) {
    case "candidate":
      return "candidate_id";
    case "requirement":
      return "requirement_id";
    case "submission":
      return "submission_id";
    case "vendor":
      return "vendor_id";
  }
}

export async function listActivityLogs(
  entityType: EntityType,
  entityId: string,
): Promise<ActivityLog[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_logs")
    .select("*")
    .eq(getEntityColumn(entityType), entityId)
    .order("created_at", { ascending: false });

  return (data as ActivityLog[] | null) ?? [];
}

export async function logActivity(
  entityType: EntityType,
  entityId: string,
  action: string,
  metadata?: any,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  await supabase.from("activity_logs").insert({
    [getEntityColumn(entityType)]: entityId,
    action,
    actor_id: user.id,
    actor_name: profile?.full_name ?? null,
    metadata: metadata ?? null,
  });
}

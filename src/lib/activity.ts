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

export interface GlobalLogFilters {
  entity_id?: string;
  action?: string;
  from?: string;
  to?: string;
}

export interface GlobalActivityLog extends ActivityLog {
  entity_name: string | null;
}

function dayAfter(dateStr: string): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split("T")[0];
}

export async function listGlobalActivityLogs(
  entityType: EntityType,
  filters: GlobalLogFilters,
): Promise<{ logs: GlobalActivityLog[]; error: string | null }> {
  const supabase = await createClient();
  
  // Build the join based on the entity type to fetch the display name
  let joinString = "*";
  switch (entityType) {
    case "candidate":
      joinString = "*, candidates!inner(full_name)";
      break;
    case "requirement":
      joinString = "*, requirements!inner(title)";
      break;
    case "submission":
      joinString = "*, submissions!inner(candidate_name)";
      break;
    case "vendor":
      joinString = "*, vendors!inner(name)";
      break;
  }

  let query = supabase
    .from("activity_logs")
    .select(joinString)
    .not(getEntityColumn(entityType), "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (filters.entity_id) {
    query = query.eq(getEntityColumn(entityType), filters.entity_id);
  }
  if (filters.action) {
    query = query.eq("action", filters.action);
  }
  if (filters.from) {
    query = query.gte("created_at", filters.from);
  }
  if (filters.to) {
    query = query.lt("created_at", dayAfter(filters.to));
  }

  const { data, error } = await query;
  if (error) return { logs: [], error: error.message };

  // Map joined data to a standard entity_name string
  const logs = ((data as any[]) ?? []).map((row) => {
    let entityName = null;
    if (entityType === "candidate") entityName = row.candidates?.full_name;
    if (entityType === "requirement") entityName = row.requirements?.title;
    if (entityType === "submission") entityName = row.submissions?.candidate_name;
    if (entityType === "vendor") entityName = row.vendors?.name;

    return {
      ...row,
      entity_name: entityName,
    };
  });

  return { logs, error: null };
}

export async function getGlobalLogOptions(entityType: EntityType): Promise<{
  actions: string[];
  entities: { id: string; name: string }[];
}> {
  const supabase = await createClient();
  
  // 1. Get unique actions for this entity type
  const { data: actionsData } = await supabase
    .from("activity_logs")
    .select("action")
    .not(getEntityColumn(entityType), "is", null);
    
  const uniqueActions = Array.from(
    new Set((actionsData ?? []).map((a) => a.action))
  ).sort();

  // 2. Get entities to populate dropdown
  let entities: { id: string; name: string }[] = [];
  if (entityType === "candidate") {
    const { data } = await supabase.from("candidates").select("id, full_name").order("full_name");
    entities = (data ?? []).map((d) => ({ id: d.id, name: d.full_name }));
  } else if (entityType === "requirement") {
    const { data } = await supabase.from("requirements").select("id, title").order("title");
    entities = (data ?? []).map((d) => ({ id: d.id, name: d.title }));
  } else if (entityType === "submission") {
    const { data } = await supabase.from("submissions").select("id, candidate_name").order("candidate_name");
    entities = (data ?? []).map((d) => ({ id: d.id, name: d.candidate_name || "Unknown" }));
  } else if (entityType === "vendor") {
    const { data } = await supabase.from("vendors").select("id, name").order("name");
    entities = (data ?? []).map((d) => ({ id: d.id, name: d.name }));
  }

  return { actions: uniqueActions, entities };
}

import { createClient } from "@/lib/supabase/server";

export type ActivityMetadata = Record<string, string | number | boolean | null>;

export interface ActivityLog {
  id: string;
  candidate_id: string | null;
  requirement_id: string | null;
  submission_id: string | null;
  vendor_id: string | null;
  action: string;
  actor_id: string | null;
  actor_name: string | null;
  metadata: ActivityMetadata | null;
  created_at: string;
}

export type EntityType = "candidate" | "requirement" | "submission" | "vendor";

type ActivityLogRow = ActivityLog & {
  candidates?: { full_name: string } | null;
  requirements?: { title: string } | null;
  submissions?: { candidates: { full_name: string } | null } | null;
  vendors?: { name: string } | null;
};

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
  metadata?: ActivityMetadata,
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

function getJoinString(entityType: EntityType): string {
  switch (entityType) {
    case "candidate":
      return "*, candidates!inner(full_name)";
    case "requirement":
      return "*, requirements!inner(title)";
    case "submission":
      return "*, submissions!inner(candidates(full_name))";
    case "vendor":
      return "*, vendors!inner(name)";
  }
}

function getEntityName(entityType: EntityType, row: ActivityLogRow): string | null {
  switch (entityType) {
    case "candidate":
      return row.candidates?.full_name ?? null;
    case "requirement":
      return row.requirements?.title ?? null;
    case "submission":
      return row.submissions?.candidates?.full_name ?? null;
    case "vendor":
      return row.vendors?.name ?? null;
  }
}

export async function listGlobalActivityLogs(
  entityType: EntityType,
  filters: GlobalLogFilters,
): Promise<{ logs: GlobalActivityLog[]; error: string | null }> {
  const supabase = await createClient();

  let query = supabase
    .from("activity_logs")
    .select(getJoinString(entityType))
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

  const logs = ((data as ActivityLogRow[] | null) ?? []).map((row) => ({
    ...row,
    entity_name: getEntityName(entityType, row),
  }));

  return { logs, error: null };
}

export async function getGlobalLogOptions(entityType: EntityType): Promise<{
  actions: string[];
  entities: { id: string; name: string }[];
}> {
  const supabase = await createClient();

  const { data: actionsData } = await supabase
    .from("activity_logs")
    .select("action")
    .not(getEntityColumn(entityType), "is", null);

  const uniqueActions = Array.from(
    new Set((actionsData ?? []).map((a) => a.action)),
  ).sort();

  let entities: { id: string; name: string }[] = [];
  if (entityType === "candidate") {
    const { data } = await supabase
      .from("candidates")
      .select("id, full_name")
      .order("full_name");
    entities = (data ?? []).map((d) => ({ id: d.id, name: d.full_name }));
  } else if (entityType === "requirement") {
    const { data } = await supabase
      .from("requirements")
      .select("id, title")
      .order("title");
    entities = (data ?? []).map((d) => ({ id: d.id, name: d.title }));
  } else if (entityType === "submission") {
    const { data } = await supabase
      .from("submissions")
      .select("id, candidates(full_name)")
      .order("created_at", { ascending: false });
    entities = (data ?? []).map((d) => ({
      id: d.id,
      name:
        (d.candidates as { full_name: string } | null)?.full_name ?? "Unknown",
    }));
  } else if (entityType === "vendor") {
    const { data } = await supabase
      .from("vendors")
      .select("id, name")
      .order("name");
    entities = (data ?? []).map((d) => ({ id: d.id, name: d.name }));
  }

  return { actions: uniqueActions, entities };
}

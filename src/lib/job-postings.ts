import { createClient } from "@/lib/supabase/server";
import type { WorkplaceType } from "@/lib/career-constants";

export interface PublicJobListItem {
  id: string;
  public_slug: string;
  title: string;
  location: string | null;
  workplace_type: WorkplaceType;
  employment_type: string | null;
  skills: string | null;
  published_at: string | null;
}

export interface PublicJobDetail extends PublicJobListItem {
  description: string | null;
}

export async function listPublicJobs(
  siteId: string,
): Promise<PublicJobListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_jobs", {
    p_site_id: siteId,
  });
  if (error) {
    console.error("listPublicJobs:", error.message);
    return [];
  }
  return (data as PublicJobListItem[]) ?? [];
}

export async function getPublicJob(
  siteId: string,
  jobSlug: string,
): Promise<PublicJobDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_job", {
    p_site_id: siteId,
    p_slug: jobSlug,
  });
  if (error) {
    console.error("getPublicJob:", error.message);
    return null;
  }
  const rows = data as PublicJobDetail[] | null;
  return rows?.[0] ?? null;
}

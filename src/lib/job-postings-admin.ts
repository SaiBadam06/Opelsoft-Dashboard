import { createClient } from "@/lib/supabase/server";
import type { CareerSite } from "@/lib/career-sites";
import type { JobPostingStatus, WorkplaceType } from "@/lib/career-constants";

export interface JobPostingRow {
  id: string;
  requirement_id: string | null;
  public_slug: string;
  title: string;
  location: string | null;
  workplace_type: WorkplaceType;
  employment_type: string | null;
  description: string | null;
  skills: string | null;
  status: JobPostingStatus;
}

export interface PostingDistributionRow {
  id: string;
  career_site_id: string | null;
  is_active: boolean;
  published_at: string | null;
}

export interface DistributionChannelRow {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
}

export interface RequirementPostingState {
  posting: JobPostingRow | null;
  distributions: PostingDistributionRow[];
  careerSites: CareerSite[];
  channels: DistributionChannelRow[];
}

const POSTING_COLUMNS =
  "id, requirement_id, public_slug, title, location, workplace_type, employment_type, description, skills, status";

export async function getRequirementPostingState(
  requirementId: string,
): Promise<RequirementPostingState> {
  const supabase = await createClient();

  const [postingRes, sitesRes, channelsRes] = await Promise.all([
    supabase
      .from("job_postings")
      .select(POSTING_COLUMNS)
      .eq("requirement_id", requirementId)
      .maybeSingle(),
    supabase
      .from("career_sites")
      .select(
        "id, slug, name, domain, logo_url, primary_color, hero_headline, hero_subtext, is_active",
      )
      .eq("is_active", true)
      .order("slug"),
    supabase
      .from("distribution_channels")
      .select("id, slug, name, is_active")
      .order("slug"),
  ]);

  const posting = (postingRes.data as JobPostingRow | null) ?? null;
  let distributions: PostingDistributionRow[] = [];

  if (posting) {
    const { data } = await supabase
      .from("posting_distributions")
      .select("id, career_site_id, is_active, published_at")
      .eq("job_posting_id", posting.id);
    distributions = (data as PostingDistributionRow[]) ?? [];
  }

  return {
    posting,
    distributions,
    careerSites: (sitesRes.data as CareerSite[]) ?? [],
    channels: (channelsRes.data as DistributionChannelRow[]) ?? [],
  };
}

import { createClient } from "@/lib/supabase/server";

import type { JobApplicationStatus } from "@/lib/career-constants";



export const APPLICATION_RESUME_BUCKET = "application-resumes";



export const APPLY_ALLOWED_TYPES = [

  "application/pdf",

  "application/msword",

  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

] as const;



export const APPLY_MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB



export interface JobApplication {

  id: string;

  job_posting_id: string;

  distribution_id: string | null;

  source: string;

  candidate_name: string;

  email: string;

  phone: string | null;

  location: string | null;

  linkedin_url: string | null;

  portfolio_url: string | null;

  resume_path: string | null;

  cover_note: string | null;

  status: JobApplicationStatus;

  created_at: string;

  updated_at: string;

}



export interface JobApplicationRow extends JobApplication {

  job_title: string;

  job_slug: string;

  requirement_id: string | null;

  site_name: string | null;

  site_slug: string | null;

}



const APP_COLUMNS =

  "id, job_posting_id, distribution_id, source, candidate_name, email, phone, location, linkedin_url, portfolio_url, resume_path, cover_note, status, created_at, updated_at";



function mapRow(

  raw: Record<string, unknown>,

): JobApplicationRow {

  const posting = raw.job_postings as

    | { title: string; public_slug: string; requirement_id: string | null }

    | { title: string; public_slug: string; requirement_id: string | null }[]

    | null;

  const dist = raw.posting_distributions as

    | {

        career_sites: { name: string; slug: string } | { name: string; slug: string }[] | null;

      }

    | {

        career_sites: { name: string; slug: string } | { name: string; slug: string }[] | null;

      }[]

    | null;



  const p = Array.isArray(posting) ? posting[0] : posting;

  const d = Array.isArray(dist) ? dist[0] : dist;

  const siteRaw = d?.career_sites;

  const site = Array.isArray(siteRaw) ? siteRaw[0] : siteRaw;



  const { job_postings: _jp, posting_distributions: _pd, ...app } = raw;



  return {

    ...(app as unknown as JobApplication),

    job_title: p?.title ?? "—",

    job_slug: p?.public_slug ?? "",

    requirement_id: p?.requirement_id ?? null,

    site_name: site?.name ?? null,

    site_slug: site?.slug ?? null,

  };

}



export async function listApplications(): Promise<JobApplicationRow[]> {

  const supabase = await createClient();

  const { data } = await supabase

    .from("job_applications")

    .select(

      `${APP_COLUMNS}, job_postings(title, public_slug, requirement_id), posting_distributions(career_sites(name, slug))`,

    )

    .order("created_at", { ascending: false });

  return ((data ?? []) as Record<string, unknown>[]).map(mapRow);

}



export async function getApplication(

  id: string,

): Promise<JobApplicationRow | null> {

  const supabase = await createClient();

  const { data } = await supabase

    .from("job_applications")

    .select(

      `${APP_COLUMNS}, job_postings(title, public_slug, requirement_id), posting_distributions(career_sites(name, slug))`,

    )

    .eq("id", id)

    .maybeSingle();

  if (!data) return null;

  return mapRow(data as Record<string, unknown>);

}



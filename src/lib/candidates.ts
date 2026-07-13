import { createClient } from "@/lib/supabase/server";
import type { CandidateStatus, PipelineStage } from "@/lib/candidate-constants";
import { deduplicateCandidates } from "@/lib/candidate-dedup";

export interface Candidate {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  experience_years: number | null;
  current_company: string | null;
  rate: number | null;
  visa: string | null;
  relocation: string | null;
  availability: string | null;
  linkedin: string | null;
  github: string | null;
  portfolio: string | null;
  primary_skills: string | null;
  secondary_skills: string | null;
  certifications: string | null;
  projects: string | null;
  education: string | null;
  preferred_location: string | null;
  status: CandidateStatus;
  pipeline_stage: PipelineStage;
  visa_transfer: boolean;
  notes: string | null;
  assigned_coordinator_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  submissions?: Array<{ id: string }> | null;
  placements?: Array<{ id: string }> | null;
  documents?: Array<{ id: string }> | null;
  coordinator?: { full_name: string | null; email: string | null } | null;
}

const COLUMNS =
  "id, full_name, email, phone, location, experience_years, current_company, rate, visa, relocation, availability, linkedin, github, portfolio, primary_skills, secondary_skills, certifications, projects, education, preferred_location, status, pipeline_stage, visa_transfer, notes, assigned_coordinator_id, created_by, updated_by, created_at, updated_at";

// Nested id lists power survivor scoring in deduplicateCandidates (activity first).
const LIST_SELECT = `${COLUMNS}, coordinator:profiles!candidates_assigned_coordinator_id_fkey(full_name, email), submissions(id), placements(id), documents(id)`;

// RLS automatically scopes these to what the current user may see
// (admins: all; coordinators: only their own).
export async function listCandidates(): Promise<Candidate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("candidates")
    .select(LIST_SELECT)
    .order("updated_at", { ascending: false });
  return deduplicateCandidates((data as Candidate[] | null) ?? []);
}

export async function getCandidate(id: string): Promise<Candidate | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("candidates")
    .select(COLUMNS)
    .eq("id", id)
    .single();
  return (data as Candidate | null) ?? null;
}

// Lightweight {id, full_name} list for select inputs (RLS-scoped).
export async function candidateOptions(): Promise<
  { id: string; full_name: string }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("candidates")
    .select("id, full_name, email, updated_at, pipeline_stage, submissions(id), placements(id), documents(id)")
    .order("full_name", { ascending: true });

  const candidates = (data ?? []).map((c) => ({
    id: c.id as string,
    full_name: c.full_name as string,
    email: (c.email as string | null) ?? null,
    pipeline_stage: (c.pipeline_stage as PipelineStage) ?? "new",
    updated_at: (c.updated_at as string) ?? "",
    submissions: (c.submissions as Array<{ id: string }> | null) ?? [],
    placements: (c.placements as Array<{ id: string }> | null) ?? [],
    documents: (c.documents as Array<{ id: string }> | null) ?? [],
  }));

  return deduplicateCandidates(candidates).map(({ id, full_name }) => ({
    id,
    full_name,
  }));
}

export interface CoordinatorOption {
  id: string;
  name: string;
}

// All coordinators + admins, for the admin reassignment control.
export async function listCoordinators(): Promise<CoordinatorOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .order("full_name", { ascending: true });
  return (data ?? []).map((p) => ({
    id: p.id as string,
    name: (p.full_name as string | null) ?? (p.email as string),
  }));
}

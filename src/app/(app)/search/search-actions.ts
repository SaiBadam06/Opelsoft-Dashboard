"use server";

import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { inferSkills, rerankCandidates } from "@/lib/parsing/gemini";
import { scoreSkills } from "@/lib/parsing/skill-match";

const SHORTLIST = 20;

// Step 1: infer the skills a job title typically requires.
export async function inferSkillsAction(title: string) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  if (!title.trim()) return { error: "Enter a job title." };
  try {
    const { required, nice_to_have } = await inferSkills(title.trim());
    return { ok: true as const, required: required ?? [], niceToHave: nice_to_have ?? [] };
  } catch (e) {
    return { error: (e as Error).message || "Could not infer skills for that title." };
  }
}

export interface SearchHit {
  candidateId: string;
  name: string;
  overlapPct: number;
  matched: string[];
  missing: string[];
  aiReason: string;
}

// Step 3: overlap-score every candidate, shortlist top N, AI re-rank the shortlist.
export async function searchCandidatesAction(skills: string[]) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const wanted = [...new Set(skills.map((s) => s.trim()).filter(Boolean))];
  if (wanted.length === 0) return { error: "Add at least one skill to search." };

  const supabase = await createClient();
  // RLS scopes this to candidates the user may see.
  const { data, error } = await supabase
    .from("candidate_parsings")
    .select("candidate_id, skills, candidates!inner(full_name)");
  if (error) return { error: error.message };

  type Row = { candidate_id: string; skills: string[]; candidates: { full_name: string } };
  const rows = (data as unknown as Row[]) ?? [];

  const scored = rows
    .map((r) => {
      const s = scoreSkills(wanted, r.skills ?? []);
      return { candidateId: r.candidate_id, name: r.candidates?.full_name ?? "Unknown", ...s };
    })
    .filter((r) => r.matched.length > 0)
    .sort((a, b) => b.overlapPct - a.overlapPct);

  if (scored.length === 0) return { ok: true as const, results: [] as SearchHit[] };

  const shortlist = scored.slice(0, SHORTLIST);

  // AI re-rank the shortlist with reasons; fail-soft to overlap order.
  let order: { candidateId: string; reason: string }[] = [];
  try {
    order = await rerankCandidates(
      wanted,
      shortlist.map((s) => ({ candidateId: s.candidateId, name: s.name, skills: s.matched })),
    );
  } catch {
    order = [];
  }
  const reasonById = new Map(order.map((o) => [o.candidateId, o.reason]));
  const rankById = new Map(order.map((o, i) => [o.candidateId, i]));

  const results: SearchHit[] = shortlist
    .map((s) => ({ ...s, aiReason: reasonById.get(s.candidateId) ?? "" }))
    .sort((a, b) => {
      const ra = rankById.get(a.candidateId) ?? Infinity;
      const rb = rankById.get(b.candidateId) ?? Infinity;
      return ra === rb ? b.overlapPct - a.overlapPct : ra - rb;
    });

  return { ok: true as const, results };
}

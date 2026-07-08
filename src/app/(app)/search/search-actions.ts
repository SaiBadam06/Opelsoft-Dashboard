"use server";

import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { inferSkills, matchCandidates } from "@/lib/parsing/gemini";
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
  bonusMatched: string[];
  aiReason: string;
}

// Step 3: score every candidate on required skills (nice-to-have counts as bonus, not %),
// shortlist top N, AI re-rank the shortlist.
export async function searchCandidatesAction(required: string[], niceToHave: string[]) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const wanted = [...new Set(required.map((s) => s.trim()).filter(Boolean))];
  const bonus = [...new Set(niceToHave.map((s) => s.trim()).filter(Boolean))];
  if (wanted.length === 0 && bonus.length === 0) return { error: "Add at least one skill to search." };

  const supabase = await createClient();
  // RLS scopes this to candidates the user may see.
  const { data, error } = await supabase
    .from("candidate_parsings")
    .select("candidate_id, skills, candidates!inner(full_name)");
  if (error) return { error: error.message };

  type Row = { candidate_id: string; skills: string[]; candidates: { full_name: string } };
  const rows = (data as unknown as Row[]) ?? [];

  // Cheap exact-overlap prefilter, only to bound how many candidates reach the AI matcher.
  // ponytail: exact-overlap shortlist; if the bench outgrows SHORTLIST, indirect-only matches
  // ranked below the top N get missed — widen SHORTLIST or prefilter smarter when that bites.
  const prelim = rows
    .map((r) => ({
      candidateId: r.candidate_id,
      name: r.candidates?.full_name ?? "Unknown",
      skills: r.skills ?? [],
      exactPct: scoreSkills(wanted, r.skills ?? []).overlapPct,
    }))
    .sort((a, b) => b.exactPct - a.exactPct)
    .slice(0, SHORTLIST);

  if (prelim.length === 0) return { ok: true as const, results: [] as SearchHit[] };

  // Map AI-returned skills back to the exact provided casing; drop anything not in the list
  // (guards against hallucinated skill names).
  const canon = (list: string[], pool: string[]): string[] => {
    const byLower = new Map(pool.map((p) => [p.toLowerCase(), p] as const));
    const mapped = list
      .map((s) => byLower.get(s.trim().toLowerCase()))
      .filter((x): x is string => Boolean(x));
    return [...new Set(mapped)];
  };
  const toHit = (
    cand: { candidateId: string; name: string },
    matched: string[],
    bonusMatched: string[],
    reason: string,
  ): SearchHit => {
    const m = canon(matched, wanted);
    return {
      candidateId: cand.candidateId,
      name: cand.name,
      matched: m,
      missing: wanted.filter((w) => !m.includes(w)),
      bonusMatched: canon(bonusMatched, bonus),
      overlapPct: wanted.length ? Math.round((m.length / wanted.length) * 100) : 0,
      aiReason: reason,
    };
  };

  // AI decides which skills each candidate satisfies (direct OR clearly implied) and ranks them.
  // Fail-soft to exact string matching if the AI call errors.
  let results: SearchHit[];
  try {
    const ranked = await matchCandidates(
      wanted,
      bonus,
      prelim.map((p) => ({ candidateId: p.candidateId, name: p.name, skills: p.skills })),
    );
    const byId = new Map(prelim.map((p) => [p.candidateId, p]));
    results = ranked
      .map((r) => {
        const cand = byId.get(r.candidateId);
        return cand ? toHit(cand, r.matched ?? [], r.bonusMatched ?? [], r.reason ?? "") : null;
      })
      .filter((r): r is SearchHit => r !== null); // AI order = best-first, preserved
  } catch {
    results = prelim
      .map((p) =>
        toHit(p, scoreSkills(wanted, p.skills).matched, scoreSkills(bonus, p.skills).matched, ""),
      )
      .sort((a, b) => b.overlapPct - a.overlapPct || b.bonusMatched.length - a.bonusMatched.length);
  }

  results = results.filter((r) => r.matched.length > 0 || r.bonusMatched.length > 0);
  return { ok: true as const, results };
}

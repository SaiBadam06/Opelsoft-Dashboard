"use server";

import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type GlobalSearchType = "candidate" | "requirement" | "vendor";

export interface GlobalSearchHit {
  id: string;
  type: GlobalSearchType;
  title: string;
  subtitle: string | null;
  href: string;
}

const PER_TYPE = 10;

// PostgREST .or() separates conditions on commas and groups with parens; % is a LIKE wildcard.
// Neutralise those so a user term can't inject filter grammar, then wildcard-wrap and
// double-quote the value so spaces and any remaining reserved chars are treated literally
// (an unquoted `%John Smith%` breaks the filter grammar). Escape embedded quotes.
function likePattern(q: string): string | null {
  const cleaned = q.replace(/[%,()\\*]/g, " ").trim();
  if (!cleaned) return null;
  const escaped = cleaned.replace(/"/g, '\\"');
  return `"%${escaped}%"`;
}

// Global topbar search. RLS scopes every table to what the current user may see.
export async function globalSearch(query: string): Promise<GlobalSearchHit[]> {
  const me = await getCurrentProfile();
  if (!me) return [];
  const pattern = query.trim().length >= 2 ? likePattern(query) : null;
  if (!pattern) return [];

  const supabase = await createClient();
  const [cand, reqs, vends] = await Promise.all([
    supabase
      .from("candidates")
      .select("id, full_name, email, primary_skills, current_company")
      .or(
        `full_name.ilike.${pattern},email.ilike.${pattern},primary_skills.ilike.${pattern},current_company.ilike.${pattern}`,
      )
      .limit(PER_TYPE),
    supabase
      .from("requirements")
      .select("id, title, end_client")
      .or(`title.ilike.${pattern},end_client.ilike.${pattern},skills.ilike.${pattern}`)
      .limit(PER_TYPE),
    supabase
      .from("vendors")
      .select("id, name, contact_name, email")
      .or(`name.ilike.${pattern},contact_name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(PER_TYPE),
  ]);

  // Surface query failures instead of silently returning nothing, so the UI can show an error.
  const firstError = cand.error ?? reqs.error ?? vends.error;
  if (firstError) throw new Error(firstError.message);

  const hits: GlobalSearchHit[] = [];
  for (const c of cand.data ?? []) {
    hits.push({
      id: c.id as string,
      type: "candidate",
      title: (c.full_name as string) || "Unnamed candidate",
      subtitle: (c.current_company as string | null) ?? (c.email as string | null),
      href: `/candidates/${c.id}`,
    });
  }
  for (const r of reqs.data ?? []) {
    hits.push({
      id: r.id as string,
      type: "requirement",
      title: (r.title as string) || "Untitled requirement",
      subtitle: r.end_client as string | null,
      href: `/requirements/${r.id}`,
    });
  }
  for (const v of vends.data ?? []) {
    hits.push({
      id: v.id as string,
      type: "vendor",
      title: (v.name as string) || "Unnamed vendor",
      subtitle: (v.contact_name as string | null) ?? (v.email as string | null),
      href: `/vendors/${v.id}`,
    });
  }
  return hits;
}

"use server";

import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { extractText } from "@/lib/parsing/extract-text";
import { parseResume } from "@/lib/parsing/gemini";
import { fetchGithubRepos } from "@/lib/parsing/github";
import { parsedToFields, normalizeSkills } from "@/lib/parsing/map";
import type { GitHubRepo, ParsedResume } from "@/lib/parsing/types";

// Parse an uploaded resume in memory — nothing is stored here.
export async function parseResumeAction(formData: FormData) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to parse." };

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractText(buffer, file.name);
    const parsed = await parseResume(text);
    const githubRepos = await fetchGithubRepos(text, parsed.github_urls ?? []);
    return { ok: true as const, fields: parsedToFields(parsed), parsed, githubRepos };
  } catch (e) {
    return { error: (e as Error).message || "Could not read this resume. Enter details manually." };
  }
}

// Persist the full parse for a saved candidate (search + provenance).
export async function saveResumeParseAction(
  candidateId: string,
  parsed: ParsedResume,
  githubRepos: GitHubRepo[],
) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };

  // parsed/githubRepos arrive from the client — guard shape and size before persisting.
  // Skills are re-derived server-side below (not trusted from the client).
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: "Invalid parse payload." };
  }
  const MAX_PAYLOAD_BYTES = 512 * 1024; // generous ceiling for one resume parse blob
  if (JSON.stringify({ parsed, githubRepos }).length > MAX_PAYLOAD_BYTES) {
    return { error: "Parse payload too large." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("candidate_parsings").insert({
    candidate_id: candidateId,
    skills: normalizeSkills([...(parsed.primary_skills ?? []), ...(parsed.secondary_skills ?? [])]),
    parsed,
    github_repos: githubRepos,
  });
  if (error) return { error: error.message };
  return { ok: true as const };
}

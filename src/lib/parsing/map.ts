import type { ParsedResume } from "./types";

// Map a parsed resume onto candidate form field values (all strings).
export function parsedToFields(p: ParsedResume): Record<string, string> {
  const projects = (p.projects ?? [])
    .map((pr) => (pr.description ? `${pr.name}: ${pr.description}` : pr.name))
    .filter(Boolean)
    .join("\n");
  return {
    full_name: p.candidate_name ?? "",
    email: p.email ?? "",
    primary_skills: (p.skills ?? []).join(", "),
    education: (p.education ?? []).join("; "),
    projects,
    github: (p.github_urls ?? [])[0] ?? "",
  };
}

// Normalize skills for storage/search: trim, lowercase, dedupe, drop empties.
export function normalizeSkills(skills: string[]): string[] {
  return [...new Set(skills.map((s) => s.trim().toLowerCase()).filter(Boolean))];
}

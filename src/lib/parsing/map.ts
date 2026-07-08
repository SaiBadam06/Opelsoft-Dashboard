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
    phone: p.phone ?? "",
    location: p.location ?? "",
    current_company: p.current_company ?? "",
    experience_years: p.experience_years ? String(p.experience_years) : "", // 0/blank → leave for manual entry
    primary_skills: (p.primary_skills ?? []).join(", "),
    secondary_skills: (p.secondary_skills ?? []).join(", "),
    education: (p.education ?? []).join("; "),
    projects,
    github: (p.github_urls ?? [])[0] ?? "",
  };
}

// Normalize skills for storage/search: trim, lowercase, dedupe, drop empties.
export function normalizeSkills(skills: string[]): string[] {
  return [...new Set(skills.map((s) => s.trim().toLowerCase()).filter(Boolean))];
}

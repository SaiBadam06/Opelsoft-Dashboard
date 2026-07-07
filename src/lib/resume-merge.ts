import type { ParsedResume } from "@/lib/gemini";

// Candidate-form field names this helper can fill.
export type FormFields = Partial<
  Record<
    | "full_name"
    | "email"
    | "phone"
    | "location"
    | "current_company"
    | "primary_skills"
    | "projects"
    | "education"
    | "github",
    string
  >
>;

// First value in `obj` whose key matches one of the patterns, coerced to string.
function pick(obj: Record<string, unknown>, patterns: RegExp[]): string {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === "") continue;
    if (patterns.some((p) => p.test(k))) return String(v);
  }
  return "";
}

/** Resume drives the form; `others` (arbitrary doc JSON) only fill blanks. */
export function mergeParsed(
  resume: ParsedResume,
  others: Record<string, unknown>[],
): FormFields {
  const f: FormFields = {
    full_name: resume.candidate_name || "",
    email: resume.email || "",
    phone: resume.phone || "",
    location: resume.location || "",
    current_company: resume.experiences?.[0]?.company || "",
    primary_skills: (resume.skills ?? []).join(", "),
    projects: (resume.projects ?? [])
      .map((p) => `${p.name}: ${p.description}`)
      .join("\n"),
    education: (resume.education ?? []).join("; "),
    github: resume.github_urls?.[0] || "",
  };

  const fillers: [keyof FormFields, RegExp[]][] = [
    ["full_name", [/name/i]],
    ["email", [/email/i]],
    ["phone", [/phone/i]],
    ["location", [/location|address|city/i]],
  ];
  for (const doc of others) {
    for (const [field, patterns] of fillers) {
      if (!f[field]) {
        const v = pick(doc, patterns);
        if (v) f[field] = v;
      }
    }
  }
  return f;
}

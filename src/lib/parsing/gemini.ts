import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ParsedResume } from "./types";

function model() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured.");
  return new GoogleGenerativeAI(key).getGenerativeModel({ model: "gemini-2.5-flash" });
}

const stripFences = (s: string) =>
  s.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

// Ported from JD-Resume-parsing (parseResume). Scoring omitted.
export async function parseResume(resumeText: string): Promise<ParsedResume> {
  const prompt = `Extract structured data from this resume.
Be exhaustive and verbatim: include EVERY job/internship in "experiences" and EVERY project in "projects", even ones mentioned only briefly. Do NOT invent anything that is not in the text.
Return ONLY valid JSON with no markdown, no code blocks, no explanation:
{
  "candidate_name": string,
  "email": string,
  "skills": string[],
  "experiences": [{ "company": string, "role": string, "duration": string, "highlights": string[] }],
  "projects": [{ "name": string, "description": string, "tech": string[], "url": string }],
  "education": string[],
  "github_urls": string[]
}
"github_urls" must list every github.com link found anywhere in the resume (profile or repo links). Use "" or [] for anything absent.

Resume Text:
${resumeText}`;

  const result = await model().generateContent(prompt);
  return JSON.parse(stripFences(result.response.text().trim())) as ParsedResume;
}

// Infer the concrete skills a job title typically requires (for global skill search).
export async function inferSkills(title: string): Promise<{ required: string[]; nice_to_have: string[] }> {
  const prompt = `For the job title "${title}", list the concrete, atomic skills and technologies it typically requires.
Split each into its own entry (e.g. "React", "TypeScript" — never "React/TypeScript"). Do not invent unrelated skills.
Return ONLY valid JSON with no markdown, no code blocks, no explanation:
{ "required": string[], "nice_to_have": string[] }`;

  const result = await model().generateContent(prompt);
  return JSON.parse(stripFences(result.response.text().trim())) as {
    required: string[];
    nice_to_have: string[];
  };
}

// Re-rank a shortlist of candidates against the confirmed skills, with a one-line reason each.
export async function rerankCandidates(
  skills: string[],
  shortlist: { candidateId: string; name: string; skills: string[] }[],
): Promise<{ candidateId: string; reason: string }[]> {
  const prompt = `You are matching candidates to a set of required skills.
Required skills: ${JSON.stringify(skills)}
Candidates (id, name, their skills):
${JSON.stringify(shortlist, null, 2)}

Rank the candidates best-match first. Give a one-line reason per candidate naming key matched and missing skills.
Return ONLY valid JSON with no markdown, no code blocks, no explanation:
{ "ranking": [{ "candidateId": string, "reason": string }] }`;

  const result = await model().generateContent(prompt);
  const parsed = JSON.parse(stripFences(result.response.text().trim())) as {
    ranking: { candidateId: string; reason: string }[];
  };
  return parsed.ranking;
}

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
Extract EVERY skill you find and split them into two lists — never leave "secondary_skills" empty if the resume mentions any supporting skills:
- "primary_skills": the candidate's core, strongest skills — main programming languages and primary frameworks/technologies they use most across roles and projects.
- "secondary_skills": supporting skills — auxiliary tools, libraries, databases, cloud/platforms, methodologies, and softer skills that appear but are not central.
Each skill goes in exactly one list (never both), as its own atomic entry (e.g. "React", "TypeScript" — never "React/TypeScript").
Also infer these from the resume:
- "phone": phone number from the contact section, else "".
- "location": the candidate's city/state (or country) from the header/contact, else "".
- "current_company": the employer of the most recent or ongoing role (the one marked "Present" or with the latest end date), else "".
- "experience_years": total years of professional work experience as a number, estimated by summing the durations of jobs and internships (round to the nearest 0.5). Use 0 if there is no work experience.
Return ONLY valid JSON with no markdown, no code blocks, no explanation:
{
  "candidate_name": string,
  "email": string,
  "phone": string,
  "location": string,
  "current_company": string,
  "experience_years": number,
  "primary_skills": string[],
  "secondary_skills": string[],
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
  const prompt = `For the job title "${title}", list the skills a candidate is actually expected to have.
- "required": ONLY the core, must-have skills that define this role — aim for the 6-10 most essential. Do NOT pad this with every tangential tool; a long required list makes every candidate look unqualified.
- "nice_to_have": secondary/bonus skills that strengthen a candidate but are not deal-breakers.
Split each into its own atomic entry (e.g. "React", "TypeScript" — never "React/TypeScript"). Do not invent unrelated skills.
Use short, canonical skill names exactly as they'd appear on a resume (e.g. "Machine Learning" not "Machine Learning Fundamentals"; "scikit-learn" not "Scikit-Learn library"). Never append "Fundamentals", "Principles", or "Basics" — those never match a real resume.
Return ONLY valid JSON with no markdown, no code blocks, no explanation:
{ "required": string[], "nice_to_have": string[] }`;

  const result = await model().generateContent(prompt);
  return JSON.parse(stripFences(result.response.text().trim())) as {
    required: string[];
    nice_to_have: string[];
  };
}

// AI skill match + rank: for each candidate decide which required / nice-to-have skills they
// satisfy — directly, or INDIRECTLY via clearly-implied skills — then rank best-match first.
export async function matchCandidates(
  required: string[],
  niceToHave: string[],
  candidates: { candidateId: string; name: string; skills: string[] }[],
): Promise<{ candidateId: string; matched: string[]; bonusMatched: string[]; reason: string }[]> {
  const prompt = `You are matching bench candidates to a role's skills.
Required skills: ${JSON.stringify(required)}
Nice-to-have skills: ${JSON.stringify(niceToHave)}
Candidates (id, name, their parsed skills):
${JSON.stringify(candidates, null, 2)}

For EACH candidate, decide which required skills and which nice-to-have skills they satisfy.
A skill counts as satisfied if the candidate lists it directly OR has skills/tools/experience that clearly imply it. Examples:
- scikit-learn, pandas, or numpy imply "Machine Learning".
- PyTorch or TensorFlow imply "Deep Learning" (and "Machine Learning").
- React, Angular, or Vue imply "JavaScript".
- Kubernetes implies "Docker"; strong SWE work can imply "Data Structures" and "Algorithms" — but only when there is real evidence.
Be reasonable and evidence-based: do NOT credit a skill the candidate shows no signal for.
Use skill names EXACTLY as written in the two lists above; never invent names not in those lists.
Rank the candidates best-match first.
Return ONLY valid JSON with no markdown, no code blocks, no explanation:
{ "ranking": [{ "candidateId": string, "matched": string[], "bonusMatched": string[], "reason": string }] }`;

  const result = await model().generateContent(prompt);
  const parsed = JSON.parse(stripFences(result.response.text().trim())) as {
    ranking: { candidateId: string; matched: string[]; bonusMatched: string[]; reason: string }[];
  };
  return parsed.ranking;
}

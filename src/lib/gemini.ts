import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const stripFences = (s: string) =>
  s.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

export interface ParsedResume {
  candidate_name: string;
  email: string;
  phone: string;
  location: string;
  skills: string[];
  experiences: { company: string; role: string; duration: string }[];
  projects: { name: string; description: string }[];
  education: string[];
  github_urls: string[];
}

const RESUME_SCHEMA = `Extract structured data from this resume. Be exhaustive and verbatim; do NOT invent anything.
Return ONLY valid JSON, no markdown or code fences:
{
  "candidate_name": string, "email": string, "phone": string, "location": string,
  "skills": string[],
  "experiences": [{ "company": string, "role": string, "duration": string }],
  "projects": [{ "name": string, "description": string }],
  "education": string[],
  "github_urls": string[]
}
Use "" or [] for anything absent.`;

/** Parse resume text (docx/txt) into structured fields. */
export async function parseResumeText(text: string): Promise<ParsedResume> {
  const res = await model.generateContent(`${RESUME_SCHEMA}\n\nResume Text:\n${text}`);
  return JSON.parse(stripFences(res.response.text().trim())) as ParsedResume;
}

/** Parse a resume PDF/image directly with Gemini vision (no pdf-parse needed). */
export async function parseResumeVision(
  base64: string,
  mimeType: string,
): Promise<ParsedResume> {
  const res = await model.generateContent([
    RESUME_SCHEMA,
    { inlineData: { data: base64, mimeType } },
  ]);
  return JSON.parse(stripFences(res.response.text().trim())) as ParsedResume;
}

const DOC_SCHEMA = `Extract every readable field from this document as flat JSON (key: value).
Use snake_case keys. Return ONLY valid JSON, no markdown or code fences.`;

/** Generic flat-JSON parse for non-resume image/PDF docs (licence, work-auth, etc). */
export async function parseDocImage(
  base64: string,
  mimeType: string,
): Promise<Record<string, unknown>> {
  const res = await model.generateContent([
    DOC_SCHEMA,
    { inlineData: { data: base64, mimeType } },
  ]);
  return JSON.parse(stripFences(res.response.text().trim())) as Record<
    string,
    unknown
  >;
}

/** Generic flat-JSON parse for non-resume text docs (cover letters, etc). */
export async function parseDocText(
  text: string,
): Promise<Record<string, unknown>> {
  const res = await model.generateContent(`${DOC_SCHEMA}\n\nDocument Text:\n${text}`);
  return JSON.parse(stripFences(res.response.text().trim())) as Record<
    string,
    unknown
  >;
}

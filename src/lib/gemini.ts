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

export async function parseResumeText(text: string): Promise<ParsedResume> {
  const prompt = `Extract structured data from this resume. Be exhaustive and verbatim; do NOT invent anything.
Return ONLY valid JSON, no markdown or code fences:
{
  "candidate_name": string, "email": string, "phone": string, "location": string,
  "skills": string[],
  "experiences": [{ "company": string, "role": string, "duration": string }],
  "projects": [{ "name": string, "description": string }],
  "education": string[],
  "github_urls": string[]
}
Use "" or [] for anything absent.

Resume Text:
${text}`;
  const res = await model.generateContent(prompt);
  return JSON.parse(stripFences(res.response.text().trim())) as ParsedResume;
}

/** Vision parse for image/scanned docs (licence, work-auth, etc). Returns whatever is readable. */
export async function parseDocImage(
  base64: string,
  mimeType: string,
): Promise<Record<string, unknown>> {
  const prompt = `Extract every readable field from this document image as flat JSON (key: value).
Use snake_case keys. Return ONLY valid JSON, no markdown or code fences.`;
  const res = await model.generateContent([
    prompt,
    { inlineData: { data: base64, mimeType } },
  ]);
  return JSON.parse(stripFences(res.response.text().trim())) as Record<
    string,
    unknown
  >;
}

import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import type { ExtractedRequirement } from "@/lib/intake-map";

const SYSTEM = `You extract structured job requirements from raw vendor recruiting emails (US IT staffing).
Return ONLY the requested fields. Rules:
- Use null for anything the email does not state. Do not guess or invent.
- FORWARDED EMAILS: if the message was forwarded (look for "Forwarded message", "From:" blocks, or a top signature that differs from the requirement body), the person who forwarded it is usually an internal colleague — IGNORE them. Take vendor_name and contact from the ORIGINAL sender/signature inside the forwarded content, not the forwarder.
- title: the job/role title.
- vendor_name: the sending company/staffing agency (from the original signature, domain, or letterhead), NOT the end client and NOT the internal forwarder.
- end_client: the actual client the role is for, if named.
- rate: keep the pay rate as written (e.g. "$65/hr C2C").
- duration: contract length (e.g. "12 months", "6+ months").
- work_mode: one of "remote", "hybrid", or "onsite". Use "hybrid" if the role mixes onsite + remote days; "onsite" if it requires being onsite with no remote option; "remote" if fully remote. null if the email doesn't say.
- must_have_skills / nice_to_have_skills: ARRAYS of individual skill names (one skill per array item; empty array if none). Keep each skill as a single clean item — do NOT break a parenthetical list such as "BA tools (e.g., FIGMA, Visio)" into separate items on its inner commas. Put a skill in nice_to_have_skills only when the email marks it optional ("plus", "a plus", "preferred", "nice to have", "good to have", "bonus", "desired", "would be great"). Everything else — and any flat skill list with no such cues — goes in must_have_skills. Do not invent a split the email does not support.
- work_authorization: visa/work-auth requirement (e.g. "USC or GC only", "H1B ok").
- submission_deadline: ISO date YYYY-MM-DD if a deadline is given; else null.
- contact_name / contact_email: the ORIGINAL vendor recruiter's contact (from the forwarded signature), not the person who forwarded the email.`;

const str = { type: Type.STRING, nullable: true } as const;
const strArray = { type: Type.ARRAY, items: { type: Type.STRING } } as const;

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: str,
    location: str,
    end_client: str,
    vendor_name: str,
    rate: str,
    duration: str,
    work_mode: { type: Type.STRING, enum: ["remote", "hybrid", "onsite"], nullable: true },
    must_have_skills: strArray,
    nice_to_have_skills: strArray,
    work_authorization: str,
    submission_deadline: str,
    contact_name: str,
    contact_email: str,
  },
  required: [
    "title",
    "location",
    "end_client",
    "vendor_name",
    "rate",
    "duration",
    "work_mode",
    "must_have_skills",
    "nice_to_have_skills",
    "work_authorization",
    "submission_deadline",
    "contact_name",
    "contact_email",
  ],
};

// Calls Gemini to turn raw email text into structured fields.
// Returns null on any failure so the caller can fall back to manual entry.
export async function extractRequirement(
  emailText: string,
): Promise<ExtractedRequirement | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[extract] GEMINI_API_KEY not set");
    return null;
  }
  const ai = new GoogleGenAI({ apiKey });
  try {
    const res = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      contents: emailText,
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        temperature: 0,
      },
    });
    const text = res.text;
    if (!text) return null;
    return JSON.parse(text) as ExtractedRequirement;
  } catch (e) {
    console.error("[extract] failed:", e);
    return null;
  }
}

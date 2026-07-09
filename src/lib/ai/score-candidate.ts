import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import type { Candidate } from "@/lib/candidates";
import type { RequirementWithVendor } from "@/lib/requirements";

// ── Types ──────────────────────────────────────────────────────────────────

export interface JobSpec {
  title: string;
  required_skills: string[];
  nice_to_have: string[];
  years_exp: string;
  work_type: string; // remote | hybrid | onsite | ""
  location: string;
}

export interface RequirementMatch {
  requirement: string;
  type: "Required" | "Nice-to-have" | "Experience" | "Education";
  verdict: "Strong" | "Partial" | "Missing";
  evidence: string;
}

export interface ScoreBreakdown {
  category: string;
  points: number;
  max: number;
  note: string;
}

export interface ScreeningResult {
  score: number; // 0-100
  eligibility: "Eligible" | "Partially Eligible" | "Not Eligible";
  reason: string;
  requirement_matches: RequirementMatch[];
  score_breakdown: ScoreBreakdown[];
}

// ── Spec + profile builders (all data comes from the DB, no file parsing) ────

const splitList = (s: string | null): string[] =>
  (s ?? "")
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

export function buildSpec(r: RequirementWithVendor): JobSpec {
  return {
    title: r.title,
    required_skills: splitList(r.skills),
    nice_to_have: splitList(r.nice_to_have_skills),
    years_exp: r.experience ?? "",
    work_type: r.work_mode ?? (r.remote ? "remote" : ""),
    location: r.location ?? "",
  };
}

// The candidate's dashboard profile + their stored resume parse when present.
export function buildProfile(c: Candidate, parsed?: unknown) {
  return {
    name: c.full_name,
    skills: [...splitList(c.primary_skills), ...splitList(c.secondary_skills)],
    experience_years: c.experience_years,
    current_company: c.current_company,
    education: c.education,
    certifications: c.certifications,
    projects: c.projects,
    // Full resume parse from candidate_parsings, if this candidate has one.
    resume_parse: parsed ?? null,
  };
}

// ── Scoring ──────────────────────────────────────────────────────────────────

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.INTEGER },
    eligibility: {
      type: Type.STRING,
      enum: ["Eligible", "Partially Eligible", "Not Eligible"],
    },
    reason: { type: Type.STRING },
    requirement_matches: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          requirement: { type: Type.STRING },
          type: {
            type: Type.STRING,
            enum: ["Required", "Nice-to-have", "Experience", "Education"],
          },
          verdict: {
            type: Type.STRING,
            enum: ["Strong", "Partial", "Missing"],
          },
          evidence: { type: Type.STRING },
        },
        required: ["requirement", "type", "verdict", "evidence"],
      },
    },
    score_breakdown: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          points: { type: Type.INTEGER },
          max: { type: Type.INTEGER },
          note: { type: Type.STRING },
        },
        required: ["category", "points", "max", "note"],
      },
    },
  },
  required: [
    "score",
    "eligibility",
    "reason",
    "requirement_matches",
    "score_breakdown",
  ],
};

const SYSTEM = `You are an ATS (Applicant Tracking System) for a US IT staffing firm.
Score one candidate against one job requirement using ONLY the structured data provided.

First build a requirement match matrix: check EVERY required skill and EVERY nice-to-have from the spec against the candidate, plus one row for years-of-experience and one for education. For each give a verdict and cite the specific evidence from the profile (name the skill/project/role — or say where it's missing):
- "Strong": the profile clearly demonstrates it (listed skill backed by a role/project, or explicit years).
- "Partial": adjacent/related evidence, or claimed but unproven.
- "Missing": no evidence at all.

Then compute the score from the matrix with these fixed weights (they sum to 100):
- Required skills: max 55  (a candidate missing many required skills CANNOT score high, regardless of extras)
- Experience: max 25
- Education: max 10
- Nice-to-have: max 10

"score" MUST equal the sum of the four breakdown points.
Eligibility: score >= 70 → "Eligible"; 40-69 → "Partially Eligible"; < 40 → "Not Eligible".
Include one requirement_matches row for every required skill and every nice-to-have — do not skip any. Do not invent skills the candidate does not have.`;

export async function scoreCandidate(
  spec: JobSpec,
  profile: ReturnType<typeof buildProfile>,
): Promise<ScreeningResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[score] GEMINI_API_KEY not set");
    return null;
  }
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Job requirement:\n${JSON.stringify(spec, null, 2)}\n\nCandidate profile:\n${JSON.stringify(profile, null, 2)}`;
  try {
    const res = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        temperature: 0,
      },
    });
    const text = res.text;
    if (!text) return null;
    return JSON.parse(text) as ScreeningResult;
  } catch (e) {
    console.error("[score] failed:", e);
    return null;
  }
}

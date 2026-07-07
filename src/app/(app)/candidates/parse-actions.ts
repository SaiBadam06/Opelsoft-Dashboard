"use server";

import { getCurrentProfile } from "@/lib/auth";
import { extractText } from "@/lib/extract-text";
import {
  parseResumeText,
  parseResumeVision,
  parseDocImage,
  parseDocText,
  type ParsedResume,
} from "@/lib/gemini";
import { mergeParsed, type FormFields } from "@/lib/resume-merge";

// Sent straight to Gemini vision (raw bytes); everything else goes via text.
const VISION_RE = /\.(pdf|png|jpe?g|webp|heic|gif|bmp|tiff?)$/i;

async function parseOne(
  file: File,
  asResume: boolean,
): Promise<
  | { kind: "resume"; parsed: ParsedResume }
  | { kind: "doc"; parsed: Record<string, unknown> }
> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (VISION_RE.test(file.name)) {
    const b64 = buffer.toString("base64");
    const mime =
      file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "image/jpeg");
    return asResume
      ? { kind: "resume", parsed: await parseResumeVision(b64, mime) }
      : { kind: "doc", parsed: await parseDocImage(b64, mime) };
  }

  const text = await extractText(buffer, file.name);
  return asResume
    ? { kind: "resume", parsed: await parseResumeText(text) }
    : { kind: "doc", parsed: await parseDocText(text) };
}

/**
 * Parses every attached file. The `doc_resume` input is the primary source
 * (structured resume parse); all other files fill blanks. Returns merged form
 * fields + the resume's parsed JSON (to persist on save) + per-file errors
 * (fail-soft: a bad file never blocks the rest).
 */
export async function autofillFromDocuments(formData: FormData): Promise<{
  fields: FormFields;
  resumeParsed: ParsedResume | null;
  errors: string[];
}> {
  const me = await getCurrentProfile();
  if (!me) return { fields: {}, resumeParsed: null, errors: ["Not authorized"] };

  const resumeFile = formData
    .getAll("doc_resume")
    .find((v): v is File => v instanceof File && v.size > 0);
  const otherFiles = [...formData.entries()]
    .filter(
      ([k, v]) =>
        k.startsWith("doc_") &&
        k !== "doc_resume" &&
        v instanceof File &&
        (v as File).size > 0,
    )
    .map(([, v]) => v as File);

  const errors: string[] = [];
  let resumeParsed: ParsedResume | null = null;
  const others: Record<string, unknown>[] = [];

  if (resumeFile) {
    try {
      const r = await parseOne(resumeFile, true);
      resumeParsed = r.parsed as ParsedResume;
    } catch (e) {
      errors.push(`${resumeFile.name}: ${(e as Error).message}`);
    }
  }
  for (const file of otherFiles) {
    try {
      const r = await parseOne(file, false);
      others.push(r.parsed as Record<string, unknown>);
    } catch (e) {
      errors.push(`${file.name}: ${(e as Error).message}`);
    }
  }

  const empty: ParsedResume = {
    candidate_name: "",
    email: "",
    phone: "",
    location: "",
    skills: [],
    experiences: [],
    projects: [],
    education: [],
    github_urls: [],
  };
  return {
    fields: mergeParsed(resumeParsed ?? empty, others),
    resumeParsed,
    errors,
  };
}

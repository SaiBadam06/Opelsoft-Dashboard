"use server";

import { getCurrentProfile } from "@/lib/auth";
import { extractText, ScannedPdfError } from "@/lib/extract-text";
import { parseResumeText, parseDocImage, type ParsedResume } from "@/lib/gemini";
import { mergeParsed, type FormFields } from "@/lib/resume-merge";

const IMAGE_RE = /\.(png|jpe?g|webp|heic)$/i;

async function parseOne(
  file: File,
): Promise<
  | { kind: "resume"; parsed: ParsedResume }
  | { kind: "doc"; parsed: Record<string, unknown> }
> {
  const buffer = Buffer.from(await file.arrayBuffer());

  // Image → vision. PDF/docx/txt → text, but fall back to vision on scanned PDFs.
  if (IMAGE_RE.test(file.name)) {
    return {
      kind: "doc",
      parsed: await parseDocImage(
        buffer.toString("base64"),
        file.type || "image/jpeg",
      ),
    };
  }
  try {
    const text = await extractText(buffer, file.name);
    return { kind: "resume", parsed: await parseResumeText(text) };
  } catch (e) {
    if (e instanceof ScannedPdfError) {
      return {
        kind: "doc",
        parsed: await parseDocImage(
          buffer.toString("base64"),
          "application/pdf",
        ),
      };
    }
    throw e;
  }
}

/**
 * Parses every attached file. The `doc_resume` input is the primary source;
 * all other files fill blanks. Returns merged form fields + the resume's parsed
 * JSON (to persist on save) + per-file errors (fail-soft).
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
      const r = await parseOne(resumeFile);
      if (r.kind === "resume") resumeParsed = r.parsed;
      else others.push(r.parsed);
    } catch (e) {
      errors.push(`${resumeFile.name}: ${(e as Error).message}`);
    }
  }
  for (const file of otherFiles) {
    try {
      const r = await parseOne(file);
      others.push(
        r.kind === "resume"
          ? (r.parsed as unknown as Record<string, unknown>)
          : r.parsed,
      );
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

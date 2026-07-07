"use server";

const JD_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function parseJdDocument(fd: FormData) {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a PDF or Word document." };
  }
  if (file.size > JD_MAX_BYTES) {
    return { error: "File must be 10 MB or smaller." };
  }
  if (!ALLOWED.has(file.type)) {
    return { error: "Only PDF and Word (.doc, .docx) files are supported." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    if (file.type === "application/pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      const text = result.text?.trim() ?? "";
      if (!text) {
        return {
          error:
            "Could not extract text from this PDF. It may be scanned or image-only.",
        };
      }
      return { ok: true as const, text };
    }

    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value?.trim() ?? "";
    if (!text) {
      return { error: "Could not extract text from this document." };
    }
    return { ok: true as const, text };
  } catch {
    return { error: "Failed to parse document. Try a different file." };
  }
}

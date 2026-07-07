import mammoth from "mammoth";

// Text extraction for the formats Gemini can't read as raw bytes: docx (via
// mammoth) and plain text. PDFs and images go straight to Gemini vision, so
// they're handled by the caller, not here.
export async function extractText(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase();

  if (ext === "docx") {
    return (await mammoth.extractRawText({ buffer })).value.trim();
  }

  return buffer.toString("utf-8").trim();
}

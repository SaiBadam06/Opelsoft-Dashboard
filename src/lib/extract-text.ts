import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

// Signals the caller should fall back to vision (image parse) for this file.
export class ScannedPdfError extends Error {}

export async function extractText(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase();

  if (ext === "pdf") {
    const parser = new PDFParse({ data: buffer });
    let text = "";
    try {
      text = (await parser.getText()).text.trim();
    } catch {
      // Corrupt/unsupported PDF — treat like a scanned one and fall back to vision.
      text = "";
    } finally {
      await parser.destroy();
    }
    if (text.length < 50)
      throw new ScannedPdfError(
        "Could not extract text from this PDF — it may be scanned or image-based.",
      );
    return text;
  }

  if (ext === "docx") {
    return (await mammoth.extractRawText({ buffer })).value.trim();
  }

  return buffer.toString("utf-8").trim();
}

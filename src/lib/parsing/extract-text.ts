import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export async function extractText(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase();
  let text = "";

  if (ext === "pdf") {
    const { text: raw } = await new PDFParse({ data: buffer }).getText();
    text = raw.trim();
    if (text.length < 50)
      throw new Error(
        "Could not extract text from this PDF. It may be scanned or image-based — please upload a text-based PDF, docx, or txt.",
      );
  } else if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value.trim();
  } else {
    text = buffer.toString("utf-8").trim();
  }

  return text;
}

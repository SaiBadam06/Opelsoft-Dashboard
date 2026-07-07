import mammoth from "mammoth";
// ponytail: require the inner lib, not the package index. index.js runs a debug
// block that reads a local test PDF and its export doesn't survive Next's CJS
// interop ("pdfParse is not a function"). The default-guard covers both shapes.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParseMod = require("pdf-parse/lib/pdf-parse.js");
const pdfParse = (pdfParseMod.default ?? pdfParseMod) as (b: Buffer) => Promise<{ text: string }>;

export async function extractText(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase();
  let text = "";

  if (ext === "pdf") {
    const data = await pdfParse(buffer);
    text = data.text.trim();
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

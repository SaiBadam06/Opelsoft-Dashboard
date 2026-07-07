import mammoth from "mammoth";
// ponytail: pdf-parse v1 bundles its own pdfjs fork with no web worker — require() avoids
// moduleResolution:bundler conflict with its export= syntax
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (b: Buffer) => Promise<{ text: string }>;

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

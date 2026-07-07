import { describe, it, expect } from "vitest";
import { extractText, ScannedPdfError } from "@/lib/extract-text";

describe("extractText", () => {
  it("reads plain text files as utf-8", async () => {
    const buf = Buffer.from("John Doe\nReact, TypeScript", "utf-8");
    expect(await extractText(buf, "resume.txt")).toContain("React, TypeScript");
  });

  it("throws ScannedPdfError on a PDF with no extractable text", async () => {
    const buf = Buffer.from("%PDF-1.4\n%%EOF", "utf-8");
    await expect(extractText(buf, "scan.pdf")).rejects.toBeInstanceOf(
      ScannedPdfError,
    );
  });
});

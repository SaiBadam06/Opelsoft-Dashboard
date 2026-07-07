import { describe, it, expect } from "vitest";
import { extractText } from "@/lib/extract-text";

describe("extractText", () => {
  it("reads plain text files as utf-8", async () => {
    const buf = Buffer.from("John Doe\nReact, TypeScript", "utf-8");
    expect(await extractText(buf, "resume.txt")).toContain("React, TypeScript");
  });

  it("trims surrounding whitespace", async () => {
    const buf = Buffer.from("  hello  ", "utf-8");
    expect(await extractText(buf, "note.txt")).toBe("hello");
  });
});

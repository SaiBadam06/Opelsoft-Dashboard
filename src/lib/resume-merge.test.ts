import { describe, it, expect } from "vitest";
import { mergeParsed } from "@/lib/resume-merge";
import type { ParsedResume } from "@/lib/gemini";

const resume: ParsedResume = {
  candidate_name: "Jane Dev",
  email: "jane@x.com",
  phone: "555-1212",
  location: "Austin, TX",
  skills: ["React", "TypeScript"],
  experiences: [{ company: "Acme", role: "SWE", duration: "2 yrs" }],
  projects: [{ name: "Bench", description: "matcher" }],
  education: ["BS CS, UT"],
  github_urls: ["https://github.com/jane"],
};

describe("mergeParsed", () => {
  it("maps resume fields to candidate form field names", () => {
    const f = mergeParsed(resume, []);
    expect(f.full_name).toBe("Jane Dev");
    expect(f.email).toBe("jane@x.com");
    expect(f.primary_skills).toBe("React, TypeScript");
    expect(f.current_company).toBe("Acme");
    expect(f.github).toBe("https://github.com/jane");
    expect(f.education).toContain("BS CS, UT");
  });

  it("fills blanks from other docs but resume wins overlaps", () => {
    const bare = { ...resume, phone: "", location: "" };
    const f = mergeParsed(bare, [
      { full_name: "IGNORED", phone_number: "999", address: "Dallas" },
    ]);
    expect(f.full_name).toBe("Jane Dev"); // resume wins
    expect(f.phone).toBe("999"); // blank filled from doc
    expect(f.location).toBe("Dallas");
  });
});

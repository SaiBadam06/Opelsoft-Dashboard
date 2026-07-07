import { describe, expect, it } from "vitest";
import { normalizeSkills, parsedToFields } from "./map";
import type { ParsedResume } from "./types";

const base: ParsedResume = {
  candidate_name: "Ada Lovelace",
  email: "ada@example.com",
  skills: ["React", "TypeScript"],
  experiences: [],
  projects: [{ name: "Analytical Engine", description: "compute", tech: ["math"], url: "" }],
  education: ["BSc Math", "MSc CS"],
  github_urls: ["https://github.com/ada", "https://github.com/ada/engine"],
};

describe("parsedToFields", () => {
  it("maps parse onto form fields", () => {
    const f = parsedToFields(base);
    expect(f.full_name).toBe("Ada Lovelace");
    expect(f.email).toBe("ada@example.com");
    expect(f.primary_skills).toBe("React, TypeScript");
    expect(f.education).toBe("BSc Math; MSc CS");
    expect(f.projects).toBe("Analytical Engine: compute");
    expect(f.github).toBe("https://github.com/ada"); // first url
  });

  it("tolerates empty arrays/strings", () => {
    const f = parsedToFields({ ...base, skills: [], education: [], projects: [], github_urls: [] });
    expect(f.primary_skills).toBe("");
    expect(f.github).toBe("");
    expect(f.projects).toBe("");
  });
});

describe("normalizeSkills", () => {
  it("trims, lowercases, dedupes, drops empties", () => {
    expect(normalizeSkills([" React ", "react", "TypeScript", "", "  "])).toEqual([
      "react",
      "typescript",
    ]);
  });
});

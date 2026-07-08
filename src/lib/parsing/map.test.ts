import { describe, expect, it } from "vitest";
import { normalizeSkills, parsedToFields } from "./map";
import type { ParsedResume } from "./types";

const base: ParsedResume = {
  candidate_name: "Ada Lovelace",
  email: "ada@example.com",
  phone: "555-0100",
  location: "London, UK",
  current_company: "Analytical Engines Ltd",
  experience_years: 4,
  primary_skills: ["React", "TypeScript"],
  secondary_skills: ["Docker", "Figma"],
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
    expect(f.phone).toBe("555-0100");
    expect(f.location).toBe("London, UK");
    expect(f.current_company).toBe("Analytical Engines Ltd");
    expect(f.experience_years).toBe("4");
    expect(f.primary_skills).toBe("React, TypeScript");
    expect(f.secondary_skills).toBe("Docker, Figma");
    expect(f.education).toBe("BSc Math; MSc CS");
    expect(f.projects).toBe("Analytical Engine: compute");
    expect(f.github).toBe("https://github.com/ada"); // first url
  });

  it("tolerates empty arrays/strings", () => {
    const f = parsedToFields({
      ...base,
      experience_years: 0,
      primary_skills: [],
      secondary_skills: [],
      education: [],
      projects: [],
      github_urls: [],
    });
    expect(f.primary_skills).toBe("");
    expect(f.secondary_skills).toBe("");
    expect(f.experience_years).toBe(""); // 0 years → blank for manual entry
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

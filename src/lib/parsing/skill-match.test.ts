import { describe, expect, it } from "vitest";
import { scoreSkills } from "./skill-match";

describe("scoreSkills", () => {
  it("matches exact skills case-insensitively", () => {
    const r = scoreSkills(["React", "TypeScript"], ["react", "TYPESCRIPT"]);
    expect(r.matched.sort()).toEqual(["react", "typescript"]);
    expect(r.missing).toEqual([]);
    expect(r.overlapPct).toBe(100);
  });

  it("matches via synonyms (js↔javascript, k8s↔kubernetes)", () => {
    const r = scoreSkills(["JavaScript", "Kubernetes"], ["js", "k8s"]);
    expect(r.matched.sort()).toEqual(["javascript", "kubernetes"]);
    expect(r.overlapPct).toBe(100);
  });

  it("reports missing skills and partial overlap", () => {
    const r = scoreSkills(["React", "Go", "Rust"], ["react"]);
    expect(r.matched).toEqual(["react"]);
    expect(r.missing.sort()).toEqual(["go", "rust"]);
    expect(r.overlapPct).toBe(33); // 1/3
  });

  it("dedupes required and handles empty candidate skills", () => {
    const r = scoreSkills(["React", "react"], []);
    expect(r.matched).toEqual([]);
    expect(r.missing).toEqual(["react"]);
    expect(r.overlapPct).toBe(0);
  });

  it("returns 0% when no required skills given", () => {
    expect(scoreSkills([], ["react"]).overlapPct).toBe(0);
  });
});

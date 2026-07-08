import { describe, it, expect } from "vitest";
import { buildBulletPoints } from "@/lib/career-jd";

describe("buildBulletPoints", () => {
  it("returns empty for blank input", () => {
    expect(buildBulletPoints(null)).toEqual([]);
    expect(buildBulletPoints("   ")).toEqual([]);
  });

  it("parses dash and bullet prefixes", () => {
    const text = "- Build APIs\n• Write tests\n* Deploy services";
    expect(buildBulletPoints(text)).toEqual([
      "Build APIs",
      "Write tests",
      "Deploy services",
    ]);
  });

  it("parses numbered lists", () => {
    const text = "1. First task\n2. Second task";
    expect(buildBulletPoints(text)).toEqual(["First task", "Second task"]);
  });

  it("keeps short lines as single bullets", () => {
    expect(buildBulletPoints("Short line")).toEqual(["Short line"]);
  });
});

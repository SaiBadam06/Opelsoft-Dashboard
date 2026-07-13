import { describe, it, expect } from "vitest";
import { spamCheck } from "./spamCheck";

const rules = (s: ReturnType<typeof spamCheck>) => s.warnings.map((w) => w.rule);

describe("spamCheck", () => {
  it("flags trigger words, empty subject, url shorteners", () => {
    const r = spamCheck({ subject: "", html: "<p>Act now, it's FREE — http://bit.ly/x</p>" });
    expect(rules(r)).toEqual(expect.arrayContaining(["empty-subject", "trigger-word", "shortener"]));
    expect(r.score).toBeGreaterThan(0);
  });
  it("flags red text and missing alt on images", () => {
    const r = spamCheck({ subject: "Requirements", html: '<p style="color:#C82613">hi</p><img src="x">' });
    expect(rules(r)).toEqual(expect.arrayContaining(["red-text", "img-alt"]));
  });
  it("is quiet for a clean business email", () => {
    const r = spamCheck({ subject: "Sharing a requirement", html: "<p>We have consultants available across .NET and Java. Reply to discuss details and rates for your open roles. Thanks.</p>" });
    expect(r.warnings.filter((w) => w.severity === "high")).toHaveLength(0);
  });
});

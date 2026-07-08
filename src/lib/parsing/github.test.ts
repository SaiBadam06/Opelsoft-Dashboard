import { describe, expect, it } from "vitest";
import { extractGithubLinks } from "./github-links";

describe("extractGithubLinks", () => {
  it("separates repo links from profile links", () => {
    const text = "See github.com/ada/engine and my profile github.com/ada";
    const { repos, users } = extractGithubLinks(text);
    expect(repos).toContain("ada/engine");
    expect(users).toContain("ada");
  });

  it("ignores github site pages (orgs, topics, ...)", () => {
    const { repos, users } = extractGithubLinks("github.com/orgs/foo github.com/topics/react");
    expect(repos).toEqual([]);
    expect(users).toEqual([]);
  });

  it("strips .git and trailing punctuation from repo names", () => {
    const { repos } = extractGithubLinks("clone github.com/ada/engine.git, done");
    expect(repos).toContain("ada/engine");
  });
});

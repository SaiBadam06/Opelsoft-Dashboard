import { createClient } from "@/lib/supabase/server";
import type { GitHubRepo } from "./types";
import { extractGithubLinks } from "./github-links";

const MAX_REPOS = 6;

/* eslint-disable @typescript-eslint/no-explicit-any */
const CACHE_TTL_MS = 7 * 24 * 3600 * 1000; // 7 days

async function cacheGet(key: string): Promise<any> {
  const supabase = await createClient();
  const { data } = await supabase.from("github_cache").select("data, fetched_at").eq("key", key).single();
  if (!data || Date.now() - new Date(data.fetched_at).getTime() > CACHE_TTL_MS) return null;
  return data.data;
}

async function cachePut(key: string, value: any) {
  // fail-soft: a cache write error must never break parsing
  const supabase = await createClient();
  await supabase.from("github_cache").upsert({ key, data: value, fetched_at: new Date().toISOString() });
}

async function gh(path: string): Promise<any> {
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

const toRepo = (r: any): GitHubRepo => ({
  url: r.html_url ?? "",
  name: r.full_name ?? r.name ?? "",
  description: r.description ?? "",
  language: r.language ?? "",
  stars: r.stargazers_count ?? 0,
  pushed_at: r.pushed_at ?? "",
  verified: true,
});

/** Extract GitHub links from resume text (+ any URLs Gemini found) and fetch live repo data. Fail-soft: unreachable repos come back verified:false. */
export async function fetchGithubRepos(resumeText: string, extraUrls: string[] = []): Promise<GitHubRepo[]> {
  const { repos, users } = extractGithubLinks([resumeText, ...extraUrls].join("\n"));

  const out: GitHubRepo[] = await Promise.all(
    repos.slice(0, MAX_REPOS).map(async (full) => {
      const key = `repo:${full.toLowerCase()}`;
      const hit = (await cacheGet(key)) as GitHubRepo | null;
      if (hit) return hit;
      const data = await gh(`/repos/${full}`);
      if (!data)
        return { url: `https://github.com/${full}`, name: full, description: "", language: "", stars: 0, pushed_at: "", verified: false };
      const repo = toRepo(data);
      await cachePut(key, repo);
      return repo;
    }),
  );

  // ponytail: one profile is plenty — resumes rarely link more than their own
  const user = users[0];
  if (user && out.length < MAX_REPOS) {
    const key = `user:${user.toLowerCase()}`;
    let list = (await cacheGet(key)) as GitHubRepo[] | null;
    if (!list) {
      const raw = await gh(`/users/${user}/repos?sort=pushed&per_page=${MAX_REPOS}`);
      if (Array.isArray(raw)) {
        list = raw.filter((r) => !r.fork).map(toRepo);
        await cachePut(key, list);
      }
    }
    if (list) {
      const seen = new Set(out.map((r) => r.name.toLowerCase()));
      for (const r of list.slice(0, MAX_REPOS - out.length)) {
        if (!seen.has(r.name.toLowerCase())) out.push(r);
      }
    }
  }

  return out;
}

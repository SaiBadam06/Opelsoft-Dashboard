// Pure GitHub-link extraction (no I/O) so it's unit-testable without the Supabase/Next deps.
const GH_LINK = /github\.com\/([A-Za-z0-9-]+)(?:\/([A-Za-z0-9._-]+))?/g;
// github.com/<these> are site pages, not user profiles
const NON_USER = new Set([
  "orgs", "topics", "search", "features", "about", "settings", "sponsors",
  "apps", "marketplace", "collections", "trending", "login", "join",
]);

export function extractGithubLinks(text: string): { repos: string[]; users: string[] } {
  const repos = new Set<string>();
  const users = new Set<string>();
  for (const m of text.matchAll(GH_LINK)) {
    const owner = m[1];
    if (NON_USER.has(owner.toLowerCase())) continue;
    const repo = m[2]?.replace(/\.git$/, "").replace(/[.,;:]+$/, "");
    if (repo) repos.add(`${owner}/${repo}`);
    else users.add(owner);
  }
  return { repos: [...repos], users: [...users] };
}

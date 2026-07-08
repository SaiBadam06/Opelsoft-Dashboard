// Light synonym groups so "js" matches "javascript", etc. Extend as needed.
const SYNONYMS: string[][] = [
  ["js", "javascript"],
  ["ts", "typescript"],
  ["py", "python"],
  ["k8s", "kubernetes"],
  ["node", "nodejs", "node.js"],
  ["postgres", "postgresql"],
  ["gcp", "google cloud", "google cloud platform"],
  ["aws", "amazon web services"],
  ["ml", "machine learning"],
  ["ai", "artificial intelligence"],
  ["react", "reactjs", "react.js"],
  ["next", "nextjs", "next.js"],
];

const norm = (s: string) => s.trim().toLowerCase();

// Every alias for a skill (itself + its synonym group members).
function aliases(skill: string): Set<string> {
  const s = norm(skill);
  const group = SYNONYMS.find((g) => g.includes(s));
  return new Set(group ? group : [s]);
}

// Does the candidate possess `required` (direct or via synonym)?
function has(candidateSkills: Set<string>, required: string): boolean {
  for (const alias of aliases(required)) if (candidateSkills.has(alias)) return true;
  return false;
}

export interface SkillMatch {
  matched: string[];
  missing: string[];
  overlapPct: number; // 0-100
}

// Score one candidate's stored skills against the confirmed required skills.
export function scoreSkills(required: string[], candidateSkills: string[]): SkillMatch {
  const wanted = [...new Set(required.map(norm).filter(Boolean))];
  const have = new Set(candidateSkills.map(norm).filter(Boolean));
  const matched: string[] = [];
  const missing: string[] = [];
  for (const r of wanted) (has(have, r) ? matched : missing).push(r);
  const overlapPct = wanted.length === 0 ? 0 : Math.round((matched.length / wanted.length) * 100);
  return { matched, missing, overlapPct };
}

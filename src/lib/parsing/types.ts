// Ported from JD-Resume-parsing. Scoring/validation types intentionally omitted.
export interface ParsedResume {
  candidate_name: string;
  email: string;
  phone: string;
  location: string;
  current_company: string;
  experience_years: number;
  primary_skills: string[];
  secondary_skills: string[];
  experiences: { company: string; role: string; duration: string; highlights: string[] }[];
  projects: { name: string; description: string; tech: string[]; url: string }[];
  education: string[];
  github_urls: string[];
}

export interface GitHubRepo {
  url: string;
  name: string;
  description: string;
  language: string;
  stars: number;
  pushed_at: string;
  verified: boolean;
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Search, Sparkles, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  inferSkillsAction,
  searchCandidatesAction,
  type SearchHit,
} from "@/app/(app)/search/search-actions";

export function SearchClient() {
  const [title, setTitle] = useState("");
  const [inferring, setInferring] = useState(false);
  const [searching, setSearching] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false); // skills step reached
  const [newSkill, setNewSkill] = useState("");
  const [results, setResults] = useState<SearchHit[] | null>(null);

  async function onFindSkills() {
    if (!title.trim()) {
      toast.error("Enter a job title.");
      return;
    }
    setInferring(true);
    setResults(null);
    try {
      const res = await inferSkillsAction(title);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setSkills([...new Set([...res.required, ...res.niceToHave])]);
      setConfirmed(true);
    } finally {
      setInferring(false);
    }
  }

  function removeSkill(s: string) {
    setSkills((cur) => cur.filter((x) => x !== s));
  }

  function addSkill() {
    const s = newSkill.trim();
    if (!s) return;
    if (!skills.some((x) => x.toLowerCase() === s.toLowerCase())) setSkills((cur) => [...cur, s]);
    setNewSkill("");
  }

  async function onSearch() {
    if (skills.length === 0) {
      toast.error("Add at least one skill.");
      return;
    }
    setSearching(true);
    try {
      const res = await searchCandidatesAction(skills);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setResults(res.results);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Step 1: job title */}
      <Card>
        <CardHeader>
          <CardTitle>Job title</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="e.g. Senior React Developer"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onFindSkills()}
            className="w-full sm:max-w-sm"
          />
          <Button onClick={onFindSkills} disabled={inferring}>
            {inferring ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Find skills
          </Button>
        </CardContent>
      </Card>

      {/* Step 2: confirm skills */}
      {confirmed ? (
        <Card>
          <CardHeader>
            <CardTitle>Required skills</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              This title needs these skills. Add or remove any, then search the bench.
            </p>
            <div className="flex flex-wrap gap-2">
              {skills.length === 0 ? (
                <span className="text-sm text-muted-foreground">No skills — add some below.</span>
              ) : (
                skills.map((s) => (
                  <Badge key={s} variant="secondary" className="gap-1 py-1">
                    {s}
                    <button
                      type="button"
                      onClick={() => removeSkill(s)}
                      className="rounded-full hover:text-destructive"
                      aria-label={`Remove ${s}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                placeholder="Add a skill"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                className="w-full sm:max-w-xs"
              />
              <Button variant="outline" onClick={addSkill}>
                Add
              </Button>
              <Button onClick={onSearch} disabled={searching} className="ml-auto">
                {searching ? <Loader2 className="animate-spin" /> : <Search />}
                Search candidates
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Step 3: results */}
      {results ? (
        <Card>
          <CardHeader>
            <CardTitle>Best matches ({results.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No candidates matched. Candidates only appear here once they have a parsed resume
                (autofill on creation stores their skills).
              </p>
            ) : (
              results.map((r) => (
                <div key={r.candidateId} className="flex flex-col gap-2 rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/candidates/${r.candidateId}`} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                    <Badge variant="outline">{r.overlapPct}% match</Badge>
                  </div>
                  {r.aiReason ? <p className="text-sm text-muted-foreground">{r.aiReason}</p> : null}
                  <div className="flex flex-wrap gap-1">
                    {r.matched.map((s) => (
                      <Badge key={s} className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400">
                        {s}
                      </Badge>
                    ))}
                    {r.missing.map((s) => (
                      <Badge key={s} variant="outline" className="text-muted-foreground line-through">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

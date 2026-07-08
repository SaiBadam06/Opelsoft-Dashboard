"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronDown, Loader2, Search, Sparkles, X } from "lucide-react";

import { cn } from "@/lib/utils";
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
  const [required, setRequired] = useState<string[]>([]);
  const [niceToHave, setNiceToHave] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false); // skills step reached
  const [newSkill, setNewSkill] = useState("");
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [openReason, setOpenReason] = useState<string | null>(null); // candidateId whose reasoning is shown

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
      const req = [...new Set(res.required)];
      setRequired(req);
      // Drop nice-to-haves that duplicate a required skill.
      setNiceToHave(res.niceToHave.filter((s) => !req.some((r) => r.toLowerCase() === s.toLowerCase())));
      setConfirmed(true);
    } finally {
      setInferring(false);
    }
  }

  function addSkill() {
    const s = newSkill.trim();
    if (!s) return;
    const exists = [...required, ...niceToHave].some((x) => x.toLowerCase() === s.toLowerCase());
    if (!exists) setRequired((cur) => [...cur, s]); // manual adds are treated as required
    setNewSkill("");
  }

  async function onSearch() {
    if (required.length === 0 && niceToHave.length === 0) {
      toast.error("Add at least one skill.");
      return;
    }
    setSearching(true);
    try {
      const res = await searchCandidatesAction(required, niceToHave);
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
            <CardTitle>Skills</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Required skills set the match %. Nice-to-have skills are a bonus. Add or remove any,
              then search the bench.
            </p>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">Required (primary)</span>
              <div className="flex flex-wrap gap-2">
                {required.length === 0 ? (
                  <span className="text-sm text-muted-foreground">None — add some below.</span>
                ) : (
                  required.map((s) => (
                    <Badge key={s} variant="secondary" className="gap-1 py-1">
                      {s}
                      <button
                        type="button"
                        onClick={() => setRequired((cur) => cur.filter((x) => x !== s))}
                        className="rounded-full hover:text-destructive"
                        aria-label={`Remove ${s}`}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
            </div>

            {niceToHave.length ? (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Nice-to-have (secondary)
                </span>
                <div className="flex flex-wrap gap-2">
                  {niceToHave.map((s) => (
                    <Badge key={s} variant="outline" className="gap-1 py-1">
                      {s}
                      <button
                        type="button"
                        onClick={() => setNiceToHave((cur) => cur.filter((x) => x !== s))}
                        className="rounded-full hover:text-destructive"
                        aria-label={`Remove ${s}`}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Input
                placeholder="Add a required skill"
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
                    {r.aiReason ? (
                      <button
                        type="button"
                        onClick={() =>
                          setOpenReason((cur) => (cur === r.candidateId ? null : r.candidateId))
                        }
                        title="Click for match reasoning"
                        aria-expanded={openReason === r.candidateId}
                      >
                        <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                          {r.overlapPct}% match
                          <ChevronDown
                            className={cn(
                              "size-3 transition-transform",
                              openReason === r.candidateId && "rotate-180",
                            )}
                          />
                        </Badge>
                      </button>
                    ) : (
                      <Badge variant="outline">{r.overlapPct}% match</Badge>
                    )}
                  </div>
                  {openReason === r.candidateId && r.aiReason ? (
                    <p className="rounded-md bg-muted/50 p-2 text-sm text-muted-foreground">
                      {r.aiReason}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-1">
                    {r.matched.map((s) => (
                      <Badge key={s} className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400">
                        {s}
                      </Badge>
                    ))}
                    {r.bonusMatched.map((s) => (
                      <Badge key={s} className="bg-sky-600/15 text-sky-700 dark:text-sky-400">
                        +{s}
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

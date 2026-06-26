"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Users } from "lucide-react";

import type { Candidate } from "@/lib/candidates";
import { stageLabel } from "@/lib/candidate-constants";
import { StatusSelect } from "./status-select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function matches(c: Candidate, q: string): boolean {
  const haystack = [
    c.full_name,
    c.primary_skills,
    c.visa,
    c.location,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function CandidatesTable({ candidates }: { candidates: Candidate[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => matches(c, q));
  }, [candidates, query]);

  if (candidates.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Users className="size-6" />
          </div>
          <p className="font-medium">No candidates yet</p>
          <p className="text-sm text-muted-foreground">
            Add your first candidate to get started.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, skills, visa, location"
          className="pl-8"
        />
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Visa</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Stage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  No matches
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/candidates/${c.id}`)}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{c.full_name}</span>
                      {c.current_company ? (
                        <span className="text-xs text-muted-foreground">
                          {c.current_company}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {c.rate != null ? `$${c.rate}/hr` : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span>{c.visa ?? "—"}</span>
                      {c.visa_transfer ? (
                        <Badge variant="outline">H1T</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{c.location ?? "—"}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <StatusSelect id={c.id} status={c.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {stageLabel(c.pipeline_stage)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

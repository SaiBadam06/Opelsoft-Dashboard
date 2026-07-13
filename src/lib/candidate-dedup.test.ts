import { describe, expect, it } from "vitest";
import type { DedupableCandidate } from "@/lib/candidate-dedup";
import {
  candidateKey,
  deduplicateCandidates,
  shouldReplaceCandidate,
} from "@/lib/candidate-dedup";
import type { PipelineStage } from "@/lib/candidate-constants";

function makeCandidate(
  overrides: Partial<DedupableCandidate> = {},
): DedupableCandidate {
  return {
    id: overrides.id ?? "candidate-1",
    full_name: overrides.full_name ?? "Jane Doe",
    email: overrides.email === undefined ? "jane@example.com" : overrides.email,
    pipeline_stage: (overrides.pipeline_stage as PipelineStage) ?? "new",
    updated_at: overrides.updated_at ?? "2024-01-01T00:00:00.000Z",
    submissions: overrides.submissions ?? [],
    placements: overrides.placements ?? [],
    documents: overrides.documents ?? [],
  };
}

describe("candidate deduplication", () => {
  it("keeps candidates with the same name but different emails separate", () => {
    const first = makeCandidate({
      id: "c1",
      full_name: "Jane Doe",
      email: "jane@example.com",
      updated_at: "2024-01-02T00:00:00.000Z",
    });
    const second = makeCandidate({
      id: "c2",
      full_name: "Jane Doe",
      email: "jane.alt@example.com",
      updated_at: "2024-01-03T00:00:00.000Z",
    });

    expect(candidateKey(first)).not.toBe(candidateKey(second));
    expect(deduplicateCandidates([first, second])).toHaveLength(2);
  });

  it("merges candidates with the same name and no email", () => {
    const first = makeCandidate({
      id: "c1",
      full_name: "Jane Doe",
      email: null,
      updated_at: "2024-01-02T00:00:00.000Z",
    });
    const second = makeCandidate({
      id: "c2",
      full_name: "Jane Doe",
      email: null,
      updated_at: "2024-01-03T00:00:00.000Z",
    });

    const result = deduplicateCandidates([first, second]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("c2");
  });

  it("merges candidates with the same name when one record has email and the other does not", () => {
    const first = makeCandidate({
      id: "c1",
      full_name: "Jane Doe",
      email: "jane@example.com",
      pipeline_stage: "new",
      updated_at: "2024-01-01T00:00:00.000Z",
    });
    const second = makeCandidate({
      id: "c2",
      full_name: "Jane Doe",
      email: null,
      pipeline_stage: "placed",
      updated_at: "2024-01-02T00:00:00.000Z",
    });

    const result = deduplicateCandidates([first, second]);

    expect(result).toHaveLength(1);
    // Furthest stage wins when activity ties.
    expect(result[0]?.id).toBe("c2");
  });

  it("merges candidates with the same email and prefers the one with more activity", () => {
    const first = makeCandidate({
      id: "c1",
      full_name: "Jane Doe",
      email: "jane@example.com",
      updated_at: "2024-01-01T00:00:00.000Z",
      submissions: [{ id: "s1" }],
      placements: [],
      documents: [],
    });
    const second = makeCandidate({
      id: "c2",
      full_name: "Jane Doe",
      email: "jane@example.com",
      updated_at: "2024-01-02T00:00:00.000Z",
      submissions: [{ id: "s1" }, { id: "s2" }],
      placements: [{ id: "p1" }],
      documents: [],
    });

    const result = deduplicateCandidates([first, second]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("c2");
    expect(shouldReplaceCandidate(first, second)).toBe(true);
  });

  it("prefers furthest pipeline stage when activity ties", () => {
    const first = makeCandidate({
      id: "c1",
      email: "jane@example.com",
      pipeline_stage: "new",
      updated_at: "2024-01-03T00:00:00.000Z",
    });
    const second = makeCandidate({
      id: "c2",
      email: "jane@example.com",
      pipeline_stage: "placed",
      updated_at: "2024-01-01T00:00:00.000Z",
    });

    expect(deduplicateCandidates([first, second])[0]?.id).toBe("c2");
  });
});

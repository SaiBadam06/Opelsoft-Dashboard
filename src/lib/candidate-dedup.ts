import { PIPELINE_STAGES, type PipelineStage } from "@/lib/candidate-constants";

/** Minimal shape needed to choose a survivor among duplicate candidate rows. */
export interface DedupableCandidate {
  id: string;
  full_name: string;
  email: string | null;
  pipeline_stage: PipelineStage;
  updated_at: string;
  /** Linked activity used as the primary survivor tie-breaker. */
  submissions?: Array<{ id: string }> | null;
  placements?: Array<{ id: string }> | null;
  documents?: Array<{ id: string }> | null;
}

const pipelineStageRank = new Map(
  PIPELINE_STAGES.map(({ value }, index) => [value, index]),
);

function candidateActivityScore(candidate: DedupableCandidate): number {
  return [candidate.submissions, candidate.placements, candidate.documents]
    .filter((value): value is Array<{ id: string }> => Array.isArray(value))
    .reduce((total, value) => total + value.length, 0);
}

function normalizedName(candidate: DedupableCandidate): string {
  return candidate.full_name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function candidateKey(candidate: DedupableCandidate): string {
  const normalizedEmail = candidate.email?.trim().toLowerCase();
  if (normalizedEmail) return `email:${normalizedEmail}`;

  const nameKey = normalizedName(candidate);
  if (nameKey) return `name:${nameKey}`;

  return `id:${candidate.id}`;
}

export function shouldReplaceCandidate(
  current: DedupableCandidate,
  incoming: DedupableCandidate,
): boolean {
  const currentActivityScore = candidateActivityScore(current);
  const incomingActivityScore = candidateActivityScore(incoming);

  if (incomingActivityScore !== currentActivityScore) {
    return incomingActivityScore > currentActivityScore;
  }

  const currentStageRank = pipelineStageRank.get(current.pipeline_stage) ?? -1;
  const incomingStageRank = pipelineStageRank.get(incoming.pipeline_stage) ?? -1;

  if (incomingStageRank !== currentStageRank) {
    return incomingStageRank > currentStageRank;
  }

  return Date.parse(incoming.updated_at) > Date.parse(current.updated_at);
}

/**
 * Collapse duplicate candidates for display / pickers.
 *
 * Identity rules (email-first):
 * - Same email → merge
 * - Same name, neither has email → merge
 * - Same name, one has email and the other does not → merge into that group
 * - Same name, different emails → keep separate (different people)
 *
 * Survivor preference: more linked activity (submissions/placements/documents),
 * then furthest pipeline stage, then newest `updated_at`.
 */
export function deduplicateCandidates<T extends DedupableCandidate>(
  candidates: T[],
): T[] {
  const deduped: T[] = [];
  const emailIndex = new Map<string, number>();
  const nameGroup = new Map<string, Set<number>>();

  for (const candidate of candidates) {
    const normalizedEmail = candidate.email?.trim().toLowerCase();
    const nameKey = normalizedName(candidate);
    const group = nameKey ? nameGroup.get(nameKey) : undefined;
    const groupSize = group?.size ?? 0;

    let index: number | undefined;

    if (normalizedEmail) {
      index = emailIndex.get(normalizedEmail);

      // Name-only existing row with no email can merge into this emailed row.
      if (index === undefined && groupSize === 1) {
        const [existingIndex] = Array.from(group!);
        const existing = deduped[existingIndex];
        if (!existing.email) {
          index = existingIndex;
        }
      }
    } else if (groupSize === 1) {
      // No email: merge only into a single existing name group member.
      index = Array.from(group!)[0];
    }

    if (index === undefined) {
      index = deduped.length;
      deduped.push(candidate);
    } else if (shouldReplaceCandidate(deduped[index], candidate)) {
      deduped[index] = candidate;
    }

    if (normalizedEmail) {
      emailIndex.set(normalizedEmail, index);
    }

    if (nameKey) {
      const set = nameGroup.get(nameKey) ?? new Set<number>();
      set.add(index);
      nameGroup.set(nameKey, set);
    }
  }

  return deduped;
}

/**
 * Split job description text into bullet points (Khushi recruitment pattern).
 * Handles newline lists, bullet chars, and sentence chunks for long paragraphs.
 */
export function buildBulletPoints(description: string | null | undefined): string[] {
  if (!description?.trim()) return [];

  const lines = description
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const bullets: string[] = [];

  for (const line of lines) {
    const bulletMatch = line.match(/^[-•*▪]\s+(.+)$/);
    if (bulletMatch) {
      bullets.push(bulletMatch[1].trim());
      continue;
    }
    const numberedMatch = line.match(/^\d+[.)]\s+(.+)$/);
    if (numberedMatch) {
      bullets.push(numberedMatch[1].trim());
      continue;
    }
    if (line.length > 120 && !line.includes("\n")) {
      const sentences = line
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);
      bullets.push(...sentences);
    } else {
      bullets.push(line);
    }
  }

  return bullets;
}

/**
 * A companion's system prompt is the creator's text, sovereign, plus what the
 * companion remembers about the person it is talking to. Nothing else is
 * layered on top: no product persona, no platform awareness. That restraint is
 * what keeps a companion self-contained enough to clone or embody.
 */

export const MEMORY_SECTION_HEADING = '## What you remember about this person';

export interface CompanionPromptParts {
  /** The creator's `system_prompt` column, as written. */
  definition: string | null | undefined;
  /** Memories recalled for this (companion, person) pair, most relevant first. */
  memories: string[];
  /** What the companion may set in motion for its owner (hands.ts), if anything. */
  hands?: string;
}

/**
 * Compose the prompt for one turn. Returns undefined when there is nothing to
 * send (no definition and no memories) so the caller can omit the system role.
 */
export function buildCompanionSystemPrompt({
  definition,
  memories,
  hands,
}: CompanionPromptParts): string | undefined {
  const base = definition?.trim() ?? '';
  const facts = memories.map(m => m.trim()).filter(Boolean);
  const parts: string[] = base ? [base] : [];
  if (facts.length > 0) {
    parts.push(
      [
        MEMORY_SECTION_HEADING,
        'Use these naturally when they matter; never recite them as a list, and never claim to remember something that is not here.',
        ...facts.map(f => `- ${f}`),
      ].join('\n')
    );
  }
  if (hands?.trim()) {
    parts.push(hands.trim());
  }
  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

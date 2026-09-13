/**
 * The revision loop — the reason the Studio exists.
 *
 * Generation models take a prompt, not a critique. So "the middle drags, bring
 * the trumpet in earlier" is not something you can send to a music model: it
 * has no idea what the middle was. This turns the previous prompt plus a note
 * in ordinary words into the NEXT prompt, carrying forward everything the
 * person did not complain about.
 *
 * That is the whole point. Not everyone is a musician; everyone is a listener.
 * A listener can always say what is wrong with what they just heard, and that
 * has to be enough to change it.
 *
 * Created: 2026-09-13
 */

import { callPlatformJson, parseJsonLoose } from '@/services/cat/platform-llm';
import { STUDIO_MEDIA, STUDIO_PROMPT_LIMITS, type StudioMedium } from '@/config/studio';
import { logger } from '@/utils/logger';

export interface RevisePromptInput {
  medium: StudioMedium;
  /** The prompt that produced what the user just saw or heard. */
  previousPrompt: string;
  /** What they want different, in their own words. */
  note: string;
}

/**
 * Craft vocabulary per medium, so the rewritten prompt speaks the language the
 * generation model responds to — which is exactly the vocabulary the user is
 * not required to have.
 */
const MEDIUM_VOCABULARY: Record<StudioMedium, string> = {
  video: 'shot type, camera movement, lens, lighting, colour, pace, and setting',
  music: 'instrumentation, tempo, key, mood, arrangement, dynamics, and production texture',
  writing: 'point of view, tense, pacing, register, and what the scene is actually about',
  image: 'composition, subject, palette, lighting, medium, and level of detail',
};

const SYSTEM = `You rewrite generation prompts for a creative studio.

You are given the prompt that produced a piece of work, and the author's note
about what they want different. Return ONE new prompt that produces the revised
piece.

RULES
- Keep everything the note does not complain about. The note is a CHANGE, not a
  new brief. If they only mention the ending, the opening must survive intact.
- Translate plain language into the craft vocabulary the model responds to.
  "The middle drags" becomes a tempo, arrangement or edit instruction.
- Never address the author. Never explain yourself. The output is a prompt, not
  a reply.
- Never invent a subject the author did not ask for.
- One prompt. No alternatives, no options, no preamble.

Output ONLY JSON: {"prompt":"the new prompt"}.`;

/**
 * Returns the rewritten prompt, or null when the platform model is unavailable
 * — callers fall back to appending the note, which is worse but never blocks
 * the user from iterating.
 */
export async function revisePrompt(input: RevisePromptInput): Promise<string | null> {
  const previous = input.previousPrompt.trim();
  const note = input.note.trim();
  if (!previous || !note) {
    return null;
  }

  const meta = STUDIO_MEDIA[input.medium];
  const user = `MEDIUM: ${meta.name}
The craft vocabulary for this medium is ${MEDIUM_VOCABULARY[input.medium]}.

PROMPT THAT PRODUCED THE CURRENT VERSION:
"""
${previous}
"""

WHAT THE AUTHOR WANTS DIFFERENT:
"""
${note}
"""

Return the new prompt as JSON.`;

  const raw = await callPlatformJson(SYSTEM, user, { temperature: 0.5, maxTokens: 700 });
  const parsed = parseJsonLoose<{ prompt?: unknown }>(raw);
  const next = typeof parsed?.prompt === 'string' ? parsed.prompt.trim() : '';

  if (!next) {
    logger.warn('Studio revision produced no prompt', { medium: input.medium }, 'Studio');
    return null;
  }
  // A model that ignores the length rule must not produce a request the
  // generate route will then reject as "Invalid request".
  return next.slice(0, STUDIO_PROMPT_LIMITS.max);
}

/**
 * What to use when the platform model is down: the previous prompt with the
 * note appended. Blunt, but it still changes the output, and it keeps the loop
 * usable rather than showing the user an error they cannot act on.
 */
export function appendNoteFallback(previousPrompt: string, note: string): string {
  return `${previousPrompt.trim()}\n\nRevision: ${note.trim()}`.slice(0, STUDIO_PROMPT_LIMITS.max);
}

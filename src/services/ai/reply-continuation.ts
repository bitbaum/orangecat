/**
 * A reply that ran out of room is finished, not stored mid-sentence.
 *
 * A model stops in one of two ways: it is done (`stop`), or it hit the output
 * cap (`length`). The second used to be stored as it came: a bot's answer
 * ended "If you treat me…" (live, 2026-11-12), because the bot's cap was
 * 1,000 tokens and a reasoning model spends part of that thinking.
 *
 * Three rules, all here so the turn (sendMessage-internals) only wires them:
 *  1. The owner talking to their own bot gets room for a long answer.
 *  2. A reply cut by the cap is continued once, on the same model, and the
 *     two halves are joined.
 *  3. If it is still cut after that, the words go back to the last finished
 *     sentence and say so, with the way to get the rest.
 */

/** Output room for the owner's turn with their own bot, where the vendor allows it. */
export const OWNER_REPLY_MAX_TOKENS = 3000;

/** The finish reason every OpenAI-compatible vendor gives a capped answer. */
export function wasCutOff(finishReason: string | null | undefined): boolean {
  return finishReason === 'length';
}

/**
 * The cap for one turn. The bot's own setting stands for anyone but its
 * owner (a creator's price is per token); the owner's turn gets at least
 * OWNER_REPLY_MAX_TOKENS.
 */
export function replyTokenCap(
  stored: number | null | undefined,
  ownerTurn: boolean
): number | undefined {
  const own = stored && stored > 0 ? stored : undefined;
  if (!ownerTurn) {
    return own;
  }
  return Math.max(own ?? 0, OWNER_REPLY_MAX_TOKENS);
}

/** What the model is told to do with its own unfinished answer. */
export const CONTINUE_INSTRUCTION =
  'Your answer was cut off by the length limit. Continue it from exactly where it stopped: do not repeat anything already written, do not start over, do not apologise. Finish it.';

/** The first half and the rest, as one text: no doubled or missing space at the seam. */
export function joinContinuation(first: string, rest: string): string {
  const more = rest.replace(/^\s+/, '');
  if (!more) {
    return first;
  }
  // Cut mid-word or mid-sentence, the model resumes with the next characters;
  // after whitespace or a newline it resumes with a fresh word.
  const seam = /\s$/.test(first) || /^[,.;:!?)\]]/.test(more) ? '' : ' ';
  return `${first}${seam}${more}`;
}

/** The line a still-unfinished reply ends with. */
export const CUT_SHORT_NOTE =
  '(That is where my answer ran out of room. Say "continue" and I will go on.)';

const SENTENCE_END = /[.!?…:]["')\]]*(?=\s|$)|\n/g;

/**
 * A reply that is still cut after its continuation: back to the last finished
 * sentence when one is near the end, then the note. A reply with an open code
 * fence has it closed, so the note is not swallowed by the block.
 */
export function closeCutOff(text: string): string {
  const body = text.replace(/\s+$/, '');
  let end = -1;
  for (const m of body.matchAll(SENTENCE_END)) {
    end = m.index + m[0].length;
  }
  // Only step back over a short unfinished tail; a long one is worth keeping.
  const kept =
    end > 0 && body.length - end <= 240 ? body.slice(0, end).replace(/\s+$/, '') : `${body}…`;
  const openFence = (kept.match(/^```/gm)?.length ?? 0) % 2 === 1;
  return `${kept}${openFence ? '\n```' : ''}\n\n${CUT_SHORT_NOTE}`;
}

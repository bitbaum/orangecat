/**
 * Turning message text into the handles it might be mentioning.
 *
 * Pure: no database, no HTTP, no framework. It answers "what could this text be
 * mentioning?" and nothing else — deciding which candidates are real people is
 * `services/mentions/resolve.ts`, because that needs a query and this must stay
 * testable without one.
 *
 * WHY CANDIDATES RATHER THAN A REGEX THAT MATCHES USERNAMES
 * The obvious approach is one pattern matching a legal username. It does not
 * work here, because real usernames contain characters the tokenizer must not
 * match greedily in prose. Measured on production 2026-08-26: 91 profiles, of
 * which four real accounts are `dacota-plaettli`, `m.schaupensteiner` and two
 * plus-addressed aliases shaped like `name+test2` — dots and plus signs that the
 * username validator does not even allow, because signup derived handles from
 * email addresses and bypassed it.
 *
 * So a mention of `@m.schaupensteiner` must match a dotted handle, while
 * `@bob.` at the end of a sentence must mean `bob`, and `ask @alice.` must not
 * invent a user called `alice.`. Both fall out of the same rule: emit every
 * prefix that ends at a separator boundary, longest first, and let the lookup
 * decide. `@bob.and.alice` offers `bob.and.alice`, `bob.and`, `bob` — whichever
 * exists wins, longest first.
 */

/** A handle the text might be mentioning, with where it was found. */
export interface MentionCandidate {
  /** Character offset of the `@`. */
  index: number;
  /** The full run of characters after `@`, before any trimming. */
  raw: string;
  /** Handles to try against real usernames, longest first. */
  candidates: string[];
}

/**
 * Characters a handle may contain. Wider than the username validator on
 * purpose — it has to cover handles that already exist (see the note above),
 * not only ones the validator would accept today.
 */
const HANDLE_RUN = /[A-Za-z0-9_.+-]{1,40}/y;

/** The same character class, for testing one character at a time. */
const HANDLE_CHAR = /[A-Za-z0-9_.+-]/;

/** Longest handle we will consider, matching USERNAME_MAX_LENGTH's ceiling. */
const MAX_HANDLE_LENGTH = 40;

/**
 * `@` only starts a mention at a word boundary, so an email address in a
 * message does not produce a phantom mention of its domain: in
 * `mail me at bob@example.com` the `@` is preceded by `b`, and is skipped.
 */
function startsMention(text: string, atIndex: number): boolean {
  if (atIndex === 0) {
    return true;
  }
  return !HANDLE_CHAR.test(text[atIndex - 1]);
}

/** The handle being typed at the caret, for autocomplete. */
export interface ActiveMention {
  /** Character offset of the `@`, so the caller can replace from there. */
  start: number;
  /** What has been typed after the `@`. Empty on a bare `@`. */
  query: string;
}

/**
 * What handle, if any, is being typed at the caret right now.
 *
 * This is the autocomplete half of the same question `parseMentionCandidates`
 * answers for finished text, and it lives here rather than in the composer for
 * one reason: if a suggestion menu decided on its own what counts as a mention,
 * it could offer a completion that the resolver would then refuse to link. The
 * menu would be lying about what the product does. Both read the same character
 * class and the same word-boundary rule, so what you can be offered and what
 * will actually resolve are the same set by construction.
 *
 * @param textBeforeCaret everything up to the caret. Text AFTER the caret is
 *   deliberately ignored: editing the middle of `@ali|ce` should complete on
 *   what you have typed, not silently absorb the rest of the word.
 * @returns null when the caret is not inside a mention — no `@`, a completed
 *   mention (whitespace has ended it), or an email address's `@`.
 */
export function activeMention(textBeforeCaret: string): ActiveMention | null {
  if (!textBeforeCaret) {
    return null;
  }

  // Walk back over the handle run to find the `@` that opened it.
  let i = textBeforeCaret.length;
  while (i > 0 && HANDLE_CHAR.test(textBeforeCaret[i - 1])) {
    i--;
  }

  const at = i - 1;
  if (at < 0 || textBeforeCaret[at] !== '@' || !startsMention(textBeforeCaret, at)) {
    return null;
  }

  const query = textBeforeCaret.slice(i);
  if (query.length > MAX_HANDLE_LENGTH) {
    return null;
  }

  return { start: at, query };
}

/**
 * Every prefix of `raw` that ends on an alphanumeric character, longest first.
 *
 * Trailing punctuation is sentence punctuation far more often than it is part
 * of a handle, and separators only ever appear *between* parts of the real
 * usernames observed, never at the end.
 */
function prefixesOf(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  // Longest first: walk back from the full run, cutting at each separator.
  for (let end = raw.length; end > 0; end--) {
    const slice = raw.slice(0, end);
    // A handle never ends in a separator.
    if (!/[A-Za-z0-9]$/.test(slice)) {
      continue;
    }
    // Only cut at boundaries: either the whole run, or the character we cut
    // before was a separator. Otherwise "alice" would offer "alic", "ali"…
    const nextChar = raw[end];
    if (end !== raw.length && !/[._+-]/.test(nextChar)) {
      continue;
    }
    if (slice.length > MAX_HANDLE_LENGTH || seen.has(slice)) {
      continue;
    }
    seen.add(slice);
    out.push(slice);
  }
  return out;
}

/**
 * @returns one entry per `@` that could be a mention, in the order they appear.
 *   A run that yields no usable handle (`@`, `@...`) is omitted entirely.
 */
export function parseMentionCandidates(text: string): MentionCandidate[] {
  if (!text) {
    return [];
  }

  const found: MentionCandidate[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '@' || !startsMention(text, i)) {
      continue;
    }
    HANDLE_RUN.lastIndex = i + 1;
    const match = HANDLE_RUN.exec(text);
    if (!match || match.index !== i + 1) {
      continue;
    }
    const candidates = prefixesOf(match[0]);
    if (candidates.length > 0) {
      found.push({ index: i, raw: match[0], candidates });
    }
    // Skip past the run so `@@bob` cannot yield two mentions of the same span.
    i = i + match[0].length;
  }
  return found;
}

/**
 * Every distinct handle worth looking up, across the whole text.
 * The caller resolves these in ONE query rather than one per mention.
 */
export function collectMentionCandidates(text: string): string[] {
  const all = new Set<string>();
  for (const mention of parseMentionCandidates(text)) {
    for (const candidate of mention.candidates) {
      all.add(candidate.toLowerCase());
    }
  }
  return [...all];
}

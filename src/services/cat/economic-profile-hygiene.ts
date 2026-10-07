/**
 * What keeps "What I can offer" from silting up — pure, so it is testable
 * without a model or a database.
 *
 * The profile is PUBLIC and merge-only (an extraction can add, never remove),
 * so every bad entry the extractor lets through stays on the person's page
 * until they notice it. On the founder's own profile it had collected 22 skills
 * (six of them "web development" in different words) and assets such as
 * "Event Ticket", "Digital Download (guide or asset)" and "drafts" — the names
 * of his own listings and of words from the chat, none of them things he owns.
 *
 * Two causes, two guards:
 * - `dedupe` compared objects by their whole JSON, so `{name:"Web development"}`
 *   and `{name:"web development "}` (or the same name with a `level`) were
 *   different entries. It now compares the normalised name/text.
 * - Extraction reads the assistant's reply as context, and the assistant talks
 *   about the user's listings by name. An asset is something the person says
 *   they own, so it must be grounded in what THE USER wrote.
 */

/** Lowercase, trimmed, inner whitespace collapsed. */
export function normalizeEntryKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function entryKey(item: unknown): string {
  if (typeof item === 'string') {
    return normalizeEntryKey(item);
  }
  if (item && typeof item === 'object') {
    const o = item as { name?: unknown; text?: unknown };
    const label = typeof o.name === 'string' ? o.name : typeof o.text === 'string' ? o.text : '';
    if (label) {
      return normalizeEntryKey(label);
    }
  }
  return JSON.stringify(item);
}

/** First occurrence wins, compared by the entry's name/text. */
export function dedupeEntries<T>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const key = entryKey(it);
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(it);
    }
  }
  return out;
}

/** Words of 3+ letters — enough to tell "a drone" from "drafts". */
function significantWords(value: string): string[] {
  return normalizeEntryKey(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(word => word.length >= 3);
}

/**
 * Keep an extracted asset only if the user's own message names it: every
 * significant word of the asset appears in what they wrote. "my drone" grounds
 * "drone"; the assistant saying "your Loki Pro — 30-Day program" grounds
 * nothing, because the user never said it.
 */
export function isGroundedInUserMessage(name: string, userMessage: string): boolean {
  const said = new Set(significantWords(userMessage));
  const words = significantWords(name);
  return words.length > 0 && words.every(word => said.has(word));
}

/**
 * What is already on the profile, for the extraction prompt — so the model
 * reuses an existing name instead of adding "building websites" next to
 * "full-stack web development".
 */
export function existingEntriesNote(existing: { skills: string[]; assets: string[] }): string {
  if (existing.skills.length === 0 && existing.assets.length === 0) {
    return '';
  }
  const list = (items: string[]) => (items.length > 0 ? items.join('; ') : '(none)');
  return (
    `\n\nAlready on their profile — skills: ${list(existing.skills)}. ` +
    `Assets: ${list(existing.assets)}. ` +
    'Do not return anything that is the same as, or a narrower or reworded version of, an entry already listed.'
  );
}

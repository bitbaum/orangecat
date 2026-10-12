/**
 * Show WHY a result is there: the parts of its text that matched.
 *
 * From a hit's ranges when you have them (they include typo matches — "cqto"
 * marks "Cato" whole — and mark only the typed start of a prefix match). From
 * the query alone otherwise: every word that STARTS with a typed word, the way
 * the engine matches, never letters in the middle of a word ("lo" marks
 * "local", not "Velo").
 *
 * Plain parts, never HTML: the caller renders them, so a result's own text can
 * never be injected as markup.
 */
import { tokenize } from './normalize.ts';
import type { Range } from './engine.ts';

export interface HighlightPart {
  text: string;
  match: boolean;
}

/** Split `text` into marked and unmarked runs by `ranges` (overlaps merged). */
export function highlightRanges(text: string, ranges: readonly Range[]): HighlightPart[] {
  if (!text) {
    return [];
  }
  const sorted = ranges
    .map(r => ({ start: Math.max(0, r.start), end: Math.min(text.length, r.end) }))
    .filter(r => r.end > r.start)
    .sort((a, b) => a.start - b.start);
  const parts: HighlightPart[] = [];
  let at = 0;
  for (const r of sorted) {
    if (r.end <= at) {
      continue;
    }
    const start = Math.max(r.start, at);
    if (start > at) {
      parts.push({ text: text.slice(at, start), match: false });
    }
    parts.push({ text: text.slice(start, r.end), match: true });
    at = r.end;
  }
  if (at < text.length) {
    parts.push({ text: text.slice(at), match: false });
  }
  return parts;
}

/**
 * Mark every word of `text` that starts with a word of `query`, by the typed
 * length. For text that was not part of the search (a snippet fetched later).
 */
export function highlightQuery(text: string, query: string): HighlightPart[] {
  const typed = tokenize(query).map(t => t.term);
  if (!text || typed.length === 0) {
    return text ? [{ text, match: false }] : [];
  }
  const ranges: Range[] = [];
  for (const word of tokenize(text)) {
    const longest = typed
      .filter(t => word.term.startsWith(t))
      .sort((a, b) => b.length - a.length)[0];
    if (longest) {
      // Folding can change length (ß → ss); never mark past the word.
      ranges.push({
        start: word.start,
        end: Math.min(word.end, word.start + Array.from(longest).length),
      });
    }
  }
  return highlightRanges(text, ranges);
}

export interface Snippet {
  /** The excerpt, with "…" where text was cut. */
  text: string;
  /** The ranges that fall inside it, re-based onto `text`. */
  ranges: Range[];
}

/**
 * The part of a long text worth showing for a match: a window that starts a
 * little before the first matched word, cut at word boundaries, with "…"
 * where it was cut. Without a match it is the text's beginning. For a
 * description whose third paragraph is what matched.
 */
export function snippet(
  text: string,
  ranges: readonly Range[],
  { maxLength = 160, lead = 40 }: { maxLength?: number; lead?: number } = {}
): Snippet {
  if (text.length <= maxLength) {
    return { text, ranges: [...ranges] };
  }
  const first = ranges.reduce((min, r) => Math.min(min, r.start), Infinity);
  let start = Number.isFinite(first) ? Math.max(0, first - lead) : 0;
  if (start > 0) {
    const space = text.indexOf(' ', start);
    start = space >= 0 && space < first ? space + 1 : start;
  }
  let end = Math.min(text.length, start + maxLength);
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end);
    end = space > start ? space : end;
  }
  const before = start > 0 ? '…' : '';
  const after = end < text.length ? '…' : '';
  const shift = before.length - start;
  return {
    text: before + text.slice(start, end) + after,
    ranges: ranges
      .filter(r => r.end > start && r.start < end)
      .map(r => ({ start: Math.max(r.start, start) + shift, end: Math.min(r.end, end) + shift })),
  };
}

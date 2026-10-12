import type { Range } from './engine.ts';
export interface HighlightPart {
    text: string;
    match: boolean;
}
/** Split `text` into marked and unmarked runs by `ranges` (overlaps merged). */
export declare function highlightRanges(text: string, ranges: readonly Range[]): HighlightPart[];
/**
 * Mark every word of `text` that starts with a word of `query`, by the typed
 * length. For text that was not part of the search (a snippet fetched later).
 */
export declare function highlightQuery(text: string, query: string): HighlightPart[];
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
export declare function snippet(text: string, ranges: readonly Range[], { maxLength, lead }?: {
    maxLength?: number;
    lead?: number;
}): Snippet;

/**
 * The ONE long-form markdown pipeline. Both surfaces — the studio blog
 * (content/blog/*.md) and community articles (DB markdown) — parse through
 * bip-kit's typed-block parser and render through its reference renderer.
 *
 * Typed blocks are the security model: markdown becomes a discriminated
 * union, the renderer emits React elements from typed data, and there is no
 * HTML passthrough for content to hide in — which is why this is safe for
 * user-submitted article bodies too (rehype-sanitize became unnecessary by
 * construction when react-markdown left).
 *
 * Isomorphic on purpose (no fs, no server-only imports): the composer's live
 * preview runs the same parse client-side, so what an author previews is
 * what readers get. bip-kit's `normalizeMarkdown` is the lenient step in
 * front of its strict parser (`* ` bullets, nested items, a body `# h1`,
 * single-quoted figure captions that prettier writes on commit).
 */

import { extractToc, normalizeMarkdown, parseContentBlocks, readingTime } from 'bip-kit';
import type { ContentBlock, TocEntry } from 'bip-kit';

export interface ParsedLongform {
  blocks: ContentBlock[];
  toc: TocEntry[];
  /** Word-count based minutes (200 wpm, min 1). */
  readingMinutes: number;
}

/** Parse a long-form markdown body into bip-kit typed blocks + TOC. */
export function parseLongform(markdown: string): ParsedLongform {
  const blocks = parseContentBlocks(normalizeMarkdown(markdown));
  return {
    blocks,
    toc: extractToc(blocks),
    readingMinutes: readingTime(blocks).minutes,
  };
}

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
 * what readers get.
 */

import { extractToc, parseContentBlocks, readingTime } from 'bip-kit';
import type { ContentBlock, TocEntry } from 'bip-kit';

/**
 * Normalize author-flavored markdown to bip-kit's deliberately scoped
 * vocabulary, without changing meaning:
 *
 * - `* item` / `+ item` bullets → `- item` (bip-kit only parses `- `; two of
 *   the nine live DB articles use `* `, which would otherwise render as
 *   literal asterisk paragraphs)
 * - indented list items are flattened to top-level (the parser has no
 *   nesting; a flat item preserves the text, an unparsed one would merge
 *   into the previous paragraph)
 * - `# Heading` → `## Heading` (both surfaces render the title from
 *   metadata as the page's single h1; a body h1 outside the vocabulary
 *   would render as a literal `# …` paragraph)
 *
 * Code fences are left untouched — a `# comment` or `* pointer` inside
 * ``` fences is code, not markdown.
 */
export function normalizeLongformMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let inFence = false;
  const out = lines.map(line => {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      return line;
    }
    if (inFence) {
      return line;
    }
    if (/^# (?!#)/.test(line)) {
      return `#${line}`;
    }
    const bullet = line.match(/^(\s*)[*+] (.*)$/);
    if (bullet) {
      return `- ${bullet[2]}`;
    }
    const nested = line.match(/^\s+- (.*)$/);
    if (nested) {
      return `- ${nested[1]}`;
    }
    return line;
  });
  return out.join('\n');
}

export interface ParsedLongform {
  blocks: ContentBlock[];
  toc: TocEntry[];
  /** Word-count based minutes (200 wpm, min 1). */
  readingMinutes: number;
}

/** Parse a long-form markdown body into bip-kit typed blocks + TOC. */
export function parseLongform(markdown: string): ParsedLongform {
  const blocks = parseContentBlocks(normalizeLongformMarkdown(markdown));
  return {
    blocks,
    toc: extractToc(blocks),
    readingMinutes: readingTime(blocks).minutes,
  };
}

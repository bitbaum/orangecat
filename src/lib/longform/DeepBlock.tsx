import { ArticleBody } from 'bip-kit/react';
import { MermaidBlock } from 'bip-kit/react/mermaid';
import { parseContentBlocks, normalizeMarkdown } from 'bip-kit';
import type { ContentBlock } from 'bip-kit';

/**
 * A technical section the reader opens if they want it.
 *
 * Studio posts are written for anyone first; the parts that name files,
 * regexes and seams sit behind one line — "Under the hood: …" — as a native
 * <details>, closed by default. The markdown is a fence:
 *
 *     ```deep Under the hood: the grammar
 *     ordinary markdown, any blocks
 *     ```
 *
 * bip-kit parses an unknown fence as a code block whose `lang` is the whole
 * info string, so the renderer re-parses the body as markdown and renders it
 * through the same ArticleBody. Same block, same markup as Loki's essays
 * (loki/src/components/thoughts/DeepBlock.tsx), so a post can move between
 * the two sites unchanged. No JavaScript; keyboard and screen-reader native.
 */
export const DEEP_LANG = 'deep';

export function isDeepBlock(block: ContentBlock): block is Extract<ContentBlock, { type: 'code' }> {
  return block.type === 'code' && block.lang.split(/\s+/)[0] === DEEP_LANG;
}

export function deepTitle(lang: string): string {
  return lang.slice(DEEP_LANG.length).trim() || 'Under the hood';
}

export function deepBlocks(text: string): ContentBlock[] {
  return parseContentBlocks(normalizeMarkdown(text));
}

/** The block stream with every ```deep fence lifted into its own segment. */
export type LongformSegment =
  | { kind: 'article'; blocks: ContentBlock[] }
  | { kind: 'deep'; title: string; blocks: ContentBlock[] };

export function toSegments(blocks: ContentBlock[]): LongformSegment[] {
  const segments: LongformSegment[] = [];
  let current: ContentBlock[] = [];
  const flush = () => {
    if (current.length > 0) segments.push({ kind: 'article', blocks: current });
    current = [];
  };
  for (const block of blocks) {
    if (isDeepBlock(block)) {
      flush();
      segments.push({ kind: 'deep', title: deepTitle(block.lang), blocks: deepBlocks(block.text) });
      continue;
    }
    current.push(block);
  }
  flush();
  return segments;
}

export function DeepBlock({ title, blocks }: { title: string; blocks: ContentBlock[] }) {
  return (
    <details className="bp-deep">
      <summary className="bp-deep-summary">{title}</summary>
      <div className="bp-deep-body">
        <ArticleBody blocks={blocks} components={{ mermaid: MermaidBlock }} />
      </div>
    </details>
  );
}

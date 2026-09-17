/**
 * Turning `[F1]` into something a reader can click.
 *
 * Cat cites its web sources with short handles, and the verifier checks those
 * handles mechanically — that is what makes a researched answer checkable
 * rather than merely confident. But a handle is only half the promise. A reader
 * who sees `[F1]` in a sentence and has no way to reach the page is being shown
 * the *appearance* of a citation, which is worse than none: it borrows the
 * credibility of a source nobody can inspect.
 *
 * So this closes the loop, as a plain string rewrite over the markdown the
 * assistant already produced. `[F1]` becomes a numbered link to the source that
 * handle stands for, and the existing markdown renderer does the rest. No new
 * rendering path, no parsing of the model's prose beyond the handles
 * themselves.
 *
 * Two things it deliberately will NOT do:
 *
 * - It never invents a link. A handle with no matching source is left exactly
 *   as written. A model that cites `[F9]` when four sources were retrieved has
 *   made a mistake, and quietly hiding it — or worse, pointing it at whatever
 *   source happens to be fourth — would erase the evidence of that mistake.
 * - It never rewrites inside code. A `[F1]` in a fenced block or inline code is
 *   content, not a citation.
 */

import type { ToolCallEvent } from '@/services/cat/tool-use-types';

export interface CitationSource {
  url: string;
  title?: string;
}

/** `F1` → source. Built from the turn's tool-call results. */
export type CitationMap = Map<string, CitationSource>;

/**
 * Collect the handles a turn actually issued.
 *
 * Takes the turn's tool-call events and narrows to the ones that COMPLETED,
 * because only those carry results. A `running` event has no sources by
 * definition, and reading the union without narrowing is how a citation map
 * ends up built from events that never returned anything.
 *
 * Only entries carrying a handle participate: a search result the backend did
 * not stamp is a source the reader can still see in the chips, but not one any
 * `[F…]` refers to.
 */
export function citationsFromToolCalls(
  toolCalls: readonly ToolCallEvent[] | undefined
): CitationMap {
  const map: CitationMap = new Map();
  for (const call of toolCalls ?? []) {
    if (call.status !== 'completed') {
      continue;
    }
    for (const result of call.results ?? []) {
      if (result.handle && !map.has(result.handle)) {
        map.set(result.handle, {
          url: result.url,
          ...(result.title ? { title: result.title } : {}),
        });
      }
    }
  }
  return map;
}

/** Handles look like [F1]; the number is assigned per turn, in order met. */
const HANDLE_RE = /\[(F\d{1,3})\]/g;

/**
 * Split on code so citations inside it are left alone. Fenced blocks first,
 * then inline spans — a fence can contain backticks, so the order matters.
 */
const CODE_RE = /(```[\s\S]*?```|`[^`\n]*`)/g;

/**
 * Rewrite `[F1]` into a markdown link, leaving unknown handles untouched.
 *
 * The visible text becomes the number alone, so a sentence reads "…240 CHF a
 * month [1]" rather than carrying our internal letter into the user's view.
 * The title, where there is one, becomes the link's tooltip.
 */
export function linkifyCitations(markdown: string, sources: CitationMap): string {
  if (!markdown || sources.size === 0) {
    return markdown;
  }

  return markdown
    .split(CODE_RE)
    .map(segment => {
      // Odd segments are the code captured by the split; never touch them.
      if (segment.startsWith('```') || (segment.startsWith('`') && segment.endsWith('`'))) {
        return segment;
      }
      return segment.replace(HANDLE_RE, (whole, handle: string) => {
        const source = sources.get(handle);
        if (!source) {
          // An uncited handle stays visible. It is a mistake worth seeing.
          return whole;
        }
        const n = handle.slice(1);
        const title = source.title ? ` "${source.title.replace(/["\\]/g, '')}"` : '';
        return `[[${n}]](${source.url}${title})`;
      });
    })
    .join('');
}

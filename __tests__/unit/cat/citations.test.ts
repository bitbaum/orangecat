/**
 * Citations a reader can actually follow.
 *
 * The property worth defending hardest is the refusal: a handle with no source
 * must be left exactly as written. Pointing it at "whatever source happened to
 * be fourth" would erase the evidence of a model mistake and hand a reader a
 * link that does not support the sentence it sits in — the precise failure the
 * whole citation mechanism exists to prevent.
 */
import { linkifyCitations, citationsFromToolCalls } from '@/lib/chat/citations';
import type { ToolCallEvent, ToolCallResultRef } from '@/services/cat/tool-use-types';

/** A completed tool call, shaped exactly as the SSE stream delivers one. */
function completed(results: ToolCallResultRef[], id = 'c1'): ToolCallEvent {
  return { id, name: 'web_search', status: 'completed', resultCount: results.length, results };
}

const sources = citationsFromToolCalls([
  completed([
    { url: 'https://a.example/1', type: 'web', title: 'Zurich desks', handle: 'F1' },
    { url: 'https://b.example/2', type: 'web', title: 'Geneva desks', handle: 'F2' },
  ]),
]);

describe('collecting the handles a turn issued', () => {
  it('maps each handle to the source it stands for', () => {
    expect(sources.get('F1')).toEqual({ url: 'https://a.example/1', title: 'Zurich desks' });
    expect(sources.get('F2')?.url).toBe('https://b.example/2');
  });

  it('ignores results the backend never stamped', () => {
    const map = citationsFromToolCalls([
      completed([{ url: 'https://c.example/', type: 'entity', title: 'platform result' }]),
    ]);
    expect(map.size).toBe(0);
  });

  it('keeps the FIRST source for a handle, so a later call cannot steal it', () => {
    const map = citationsFromToolCalls([
      completed([{ url: 'https://first.example/', type: 'web', handle: 'F1' }], 'c1'),
      completed([{ url: 'https://second.example/', type: 'web', handle: 'F1' }], 'c2'),
    ]);
    expect(map.get('F1')?.url).toBe('https://first.example/');
  });

  it('survives a turn with no tool calls at all', () => {
    expect(citationsFromToolCalls(undefined).size).toBe(0);
  });

  it('ignores a call that is still RUNNING, which has no results by definition', () => {
    const map = citationsFromToolCalls([
      { id: 'c1', name: 'web_search', status: 'running', args: { query: 'x' } },
    ]);
    expect(map.size).toBe(0);
  });

  it('ignores a FAILED call, so an outage never becomes a citation', () => {
    const map = citationsFromToolCalls([
      { id: 'c1', name: 'web_search', status: 'failed', error: 'search_unavailable' },
    ]);
    expect(map.size).toBe(0);
  });
});

describe('rewriting handles into links', () => {
  it('turns a known handle into a numbered link to its source', () => {
    const out = linkifyCitations('Desks are 240 CHF a month [F1].', sources);
    expect(out).toBe('Desks are 240 CHF a month [[1]](https://a.example/1 "Zurich desks").');
  });

  it('leaves an UNKNOWN handle exactly as written', () => {
    // The model cited something it was never given. That is a mistake, and a
    // reader should be able to see it rather than be handed a plausible link.
    const out = linkifyCitations('As reported [F9].', sources);
    expect(out).toBe('As reported [F9].');
  });

  it('rewrites several handles in one sentence', () => {
    const out = linkifyCitations('Zurich [F1] is dearer than Geneva [F2].', sources);
    expect(out).toContain('[[1]](https://a.example/1');
    expect(out).toContain('[[2]](https://b.example/2');
  });

  it('never rewrites inside a fenced code block', () => {
    const md = 'Before [F1].\n\n```\nconst x = arr[F1];\n```\n\nAfter [F2].';
    const out = linkifyCitations(md, sources);
    expect(out).toContain('const x = arr[F1];');
    expect(out).toContain('Before [[1]](');
    expect(out).toContain('After [[2]](');
  });

  it('never rewrites inside inline code', () => {
    const out = linkifyCitations('Use `arr[F1]` carefully, unlike [F1].', sources);
    expect(out).toContain('`arr[F1]`');
    expect(out).toContain('unlike [[1]](');
  });

  it('is a no-op when there are no sources', () => {
    const text = 'Nothing to link [F1].';
    expect(linkifyCitations(text, new Map())).toBe(text);
  });

  it('handles a source with no title', () => {
    const map = citationsFromToolCalls([
      completed([{ url: 'https://d.example/', type: 'web', handle: 'F1' }]),
    ]);
    expect(linkifyCitations('See [F1].', map)).toBe('See [[1]](https://d.example/).');
  });

  it('does not let a title break out of the markdown link', () => {
    const map = citationsFromToolCalls([
      completed([
        { url: 'https://e.example/', type: 'web', title: 'A "quoted" \\ title', handle: 'F1' },
      ]),
    ]);
    const out = linkifyCitations('See [F1].', map);
    expect(out).toBe('See [[1]](https://e.example/ "A quoted  title").');
  });

  it('leaves ordinary bracketed text alone', () => {
    const out = linkifyCitations('An aside [see below] and [Figure 1].', sources);
    expect(out).toBe('An aside [see below] and [Figure 1].');
  });
});

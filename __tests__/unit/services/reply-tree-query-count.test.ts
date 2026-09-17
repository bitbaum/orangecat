/**
 * Opening a thread must not cost a round-trip per reply.
 *
 * `getReplies` recursed: one query AND one `enrichEventsForDisplay` per node.
 * Enrichment is itself several requests — profiles, projects, the reader's id,
 * and the three reaction tables — so a thread cost roughly six round-trips per
 * reply. Measured in production 2026-08-28 by opening one post: eight
 * `/auth/v1/user` calls alone, for a thread with three replies.
 *
 * The cost is what these tests hold. Asserting only "the tree is correct" is
 * what let the shape regress in the first place — the recursive version built a
 * perfectly correct tree.
 */

import { getReplies } from '@/services/timeline/queries/eventQueries';

const from = vi.fn();
const enrich = vi.fn();

vi.mock('@/lib/supabase/browser', () => ({
  __esModule: true,
  default: { from: (...a: unknown[]) => from(...a) },
}));
vi.mock('@/services/timeline/processors/enrichment', () => ({
  enrichEventsForDisplay: (...a: unknown[]) => enrich(...a),
}));
vi.mock('@/services/timeline/processors/reaction-state', () => ({
  attachReactionState: async <T>(x: T) => x,
  EMPTY_REACTION_STATE: {},
}));
vi.mock('@/lib/supabase/untyped', () => ({ callRpc: vi.fn() }));

/**
 * A fake table that actually honours the parent filter.
 *
 * An argument-blind mock returns the same rows whatever is asked for, which
 * makes "one query per level" and "one query per node" indistinguishable — the
 * first version of this file had one, and a mutation replacing `.in(parents)`
 * with `.eq(parents[0])` stayed green. The filter has to be real for the count
 * assertions below to mean anything.
 */
function tableOf(rows: Array<Record<string, unknown>>) {
  from.mockImplementation(() => {
    let parents: string[] = [];
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order']) {
      chain[m] = (col?: string, val?: unknown) => {
        if (col === 'parent_event_id') {
          parents = [String(val)];
        }
        return chain;
      };
    }
    chain.in = (col: string, vals: string[]) => {
      if (col === 'parent_event_id') {
        parents = vals;
      }
      return chain;
    };
    chain.limit = () =>
      Promise.resolve({
        data: rows.filter(r => parents.includes(String(r.parent_event_id))),
        error: null,
      });
    return chain;
  });
}

describe('getReplies query cost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Enrichment echoes its input, mapped to the display shape the tree needs.
    enrich.mockImplementation(async (rows: Array<Record<string, unknown>>) =>
      rows.map(r => ({ id: r.id, parentEventId: r.parent_event_id }))
    );
  });

  it('asks once per DEPTH, not once per reply', async () => {
    // Three replies to the root, none nested.
    tableOf([
      { id: 'r1', parent_event_id: 'root' },
      { id: 'r2', parent_event_id: 'root' },
      { id: 'r3', parent_event_id: 'root' },
    ]);

    const result = await getReplies('root');

    expect(result.success).toBe(true);
    expect(result.replies).toHaveLength(3);
    // Two queries: the level with replies, and the one that came back empty.
    // The recursive version made four for this shape, and one more for every
    // additional reply.
    expect(from).toHaveBeenCalledTimes(2);
  });

  it('asks for every sibling in ONE query, not one per sibling', async () => {
    // Two branches, each with a child. A per-node fetch would either take four
    // queries or — asking only about the first parent — silently lose r2's
    // child, so this pins both the count and the completeness.
    tableOf([
      { id: 'r1', parent_event_id: 'root' },
      { id: 'r2', parent_event_id: 'root' },
      { id: 'r1a', parent_event_id: 'r1' },
      { id: 'r2a', parent_event_id: 'r2' },
    ]);

    const result = await getReplies('root');

    // depth 0 (root), depth 1 (r1+r2 together), depth 2 (empty) = 3.
    expect(from).toHaveBeenCalledTimes(3);
    expect(result.replies?.map(r => r.id)).toEqual(['r1', 'r2']);
    expect(result.replies?.[0].replies?.[0].id).toBe('r1a');
    expect(result.replies?.[1].replies?.[0].id).toBe('r2a');
  });

  it('enriches the whole tree exactly once', async () => {
    tableOf([
      { id: 'r1', parent_event_id: 'root' },
      { id: 'r2', parent_event_id: 'root' },
      { id: 'r3', parent_event_id: 'r1' },
    ]);

    await getReplies('root');

    expect(enrich).toHaveBeenCalledTimes(1);
    // And it got every node, so nothing is left un-enriched.
    expect(enrich.mock.calls[0][0]).toHaveLength(3);
  });

  it('still nests replies under the right parent', async () => {
    tableOf([
      { id: 'r1', parent_event_id: 'root' },
      { id: 'r2', parent_event_id: 'r1' },
    ]);

    const result = await getReplies('root');

    expect(result.replies?.[0].id).toBe('r1');
    expect(result.replies?.[0].replies?.[0].id).toBe('r2');
    expect(result.replies?.[0].replyCount).toBe(1);
  });
});

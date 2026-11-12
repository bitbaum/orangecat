/**
 * Which hands a person is offered — and how many trips to the database it
 * takes to find out.
 *
 * Every hand used to be checked with its own read of the person's grants,
 * one after another: a dozen round trips before the model was asked, on
 * every turn, growing with each hand added. The grants are read once.
 */
import { describe, expect, it, vi } from 'vitest';
import { COMPANION_HANDS, HANDS_SECTION_HEADING } from '@/services/companions/hands';
import { handsFor } from '@/services/companions/hands-server';
import { turnTimer } from '@/services/ai/turn-timer';
import type { AnySupabaseClient } from '@/lib/supabase/types';

/** A client whose `cat_permissions` read returns `rows`, counting every read. */
function clientWith(rows: unknown[] | Error) {
  const from = vi.fn(() => {
    const result =
      rows instanceof Error
        ? { data: null, error: { message: rows.message } }
        : { data: rows, error: null };
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'gte', 'in', 'order', 'limit']) {
      builder[m] = vi.fn(() => builder);
    }
    builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
    return builder;
  });
  return { client: { from } as unknown as AnySupabaseClient, from };
}

describe('handsFor', () => {
  it('reads the grants once, however many hands there are', async () => {
    const { client, from } = clientWith([]);
    const hands = await handsFor(client, 'user-1');
    expect(from).toHaveBeenCalledTimes(1);
    expect(hands.allowed.every(a => a.auto === false)).toBe(true);
    // Nothing granted: every hand a tap may grant is offered, in listed order,
    // and the one a tap may never grant is not.
    const ids = hands.allowed.map(a => a.action.id);
    expect(ids).toEqual(COMPANION_HANDS.filter(id => id !== 'send_task_to_loki'));
    expect(hands.allowed.every(a => a.grantOnConfirm)).toBe(true);
    expect(hands.section?.startsWith(HANDS_SECTION_HEADING)).toBe(true);
  });

  it('offers nothing, and does not throw, when the grants cannot be read', async () => {
    const { client } = clientWith(new Error('db down'));
    expect(await handsFor(client, 'user-1')).toEqual({ section: undefined, allowed: [] });
  });
});

describe('turnTimer', () => {
  it('reports each phase and the total in whole milliseconds', () => {
    const clock = [0, 12.4, 12.4 + 30.2, 12.4 + 30.2 + 900.9];
    let i = 0;
    const timer = turnTimer(() => clock[Math.min(i++, clock.length - 1)]);
    timer.mark('checks');
    timer.mark('context');
    timer.mark('model');
    expect(timer.report()).toEqual({ checksMs: 12, contextMs: 30, modelMs: 901, totalMs: 944 });
  });

  it('sums a phase marked twice', () => {
    const clock = [0, 10, 20, 35];
    let i = 0;
    const timer = turnTimer(() => clock[i++]);
    timer.mark('db');
    timer.mark('model');
    timer.mark('db');
    expect(timer.report()).toEqual({ dbMs: 25, modelMs: 10, totalMs: 35 });
  });
});

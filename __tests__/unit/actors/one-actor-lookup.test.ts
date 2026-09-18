import { describe, it, expect, vi } from 'vitest';
import { lookupUserActor, getUserActorId } from '@/domain/actors';
import type { AnySupabaseClient } from '@/lib/supabase/types';

/**
 * One query for "which actor is this user".
 *
 * There were sixteen of them — two named helpers and fourteen inline copies —
 * and they disagreed about whether a missing row means `null` or means "create
 * one", whether a database error is reported or swallowed, and whether
 * `actor_type` is filtered at all.
 *
 * The one that mattered: nothing makes a user's actor unique
 * (`idx_actors_user_id` is a plain partial index), and PostgREST answers
 * `maybeSingle()` with the SAME code, `PGRST116`, for "no rows" and for "too
 * many rows" — differing only in a `details` string. `getOrCreateUserActor`
 * tested that code before creating, so an account that already had several
 * actors read as having none and it minted another. Measured on the live
 * database 2026-09-18: 93 user-actors across 88 users, one account holding six.
 * The duplicates were not bad luck; the code manufactured them.
 */

/** A client whose ACTORS query returns whatever this test wants. */
function client(result: { data?: Array<{ id: string }> | null; error?: unknown }) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => Promise.resolve({ data: result.data ?? null, error: result.error ?? null }),
  };
  return { from: () => chain } as unknown as AnySupabaseClient;
}

describe('lookupUserActor tells absence apart from failure', () => {
  it('reports no actor as a SUCCESSFUL lookup that found nothing', async () => {
    const r = await lookupUserActor(client({ data: [] }), 'u1');
    expect(r.ok).toBe(true);
    expect(r.actorId).toBeNull();
    expect(r.ok && r.duplicates).toBe(0);
  });

  it('reports a database error as a FAILED lookup, not as absence', async () => {
    const r = await lookupUserActor(client({ error: { message: 'boom' } }), 'u1');
    expect(r.ok).toBe(false);
    expect(r.actorId).toBeNull();
  });

  it('returns the one actor when there is exactly one', async () => {
    const r = await lookupUserActor(client({ data: [{ id: 'a1' }] }), 'u1');
    expect(r).toEqual({ ok: true, actorId: 'a1', duplicates: 1 });
  });
});

describe('several actors are survivable, and deterministic', () => {
  /**
   * The old code used maybeSingle(), which answers 406 for this case — so every
   * path asking about that person got an error it then read as "no actor". They
   * were 404'd out of Cat actions, 401'd out of stakeholders, shown none of
   * their own projects, and told they were not the author of their own article.
   */
  it('picks the first — the query orders oldest-first, so identity does not move', async () => {
    const r = await lookupUserActor(
      client({ data: [{ id: 'oldest' }, { id: 'newer' }, { id: 'newest' }] }),
      'u1'
    );
    expect(r.actorId).toBe('oldest');
    expect(r.ok && r.duplicates).toBe(3);
  });

  it('asks for them oldest-first rather than hoping', async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id: 'a1' }], error: null });
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.order = order;
    const c = { from: () => chain } as unknown as AnySupabaseClient;

    await lookupUserActor(c, 'u1');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: true });
  });

  it('filters actor_type rather than relying on a constraint it never names', async () => {
    const eq = vi.fn();
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = (...args: unknown[]) => {
      eq(...args);
      return chain;
    };
    chain.order = () => Promise.resolve({ data: [{ id: 'a1' }], error: null });
    const c = { from: () => chain } as unknown as AnySupabaseClient;

    await lookupUserActor(c, 'u1');
    expect(eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(eq).toHaveBeenCalledWith('actor_type', 'user');
  });
});

describe('getUserActorId fails closed', () => {
  it('returns null for a failed lookup, because callers use it to gate access', async () => {
    expect(await getUserActorId(client({ error: { message: 'boom' } }), 'u1')).toBeNull();
  });

  it('returns null when there is genuinely no actor', async () => {
    expect(await getUserActorId(client({ data: [] }), 'u1')).toBeNull();
  });

  it('returns the id when there is one', async () => {
    expect(await getUserActorId(client({ data: [{ id: 'a1' }] }), 'u1')).toBe('a1');
  });
});

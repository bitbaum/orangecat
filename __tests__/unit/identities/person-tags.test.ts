import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { personTagsFor } from '@/domain/identities/personTags';

/**
 * The keyed part of a person tag is the database's (and is tested against a
 * real Postgres in the migration's own checks). This pins what the process
 * around it must not get wrong: what it refuses, what it passes on, and that
 * "no tag" is never turned into a tag.
 */

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

function admin(result: { data?: unknown; error?: { message: string } | null } = { data: [] }) {
  const rpc = vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null }));
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe('personTagsFor', () => {
  it('asks the database for the app, the scope and the actor ids, and returns its tags', async () => {
    const { client, rpc } = admin({
      data: [
        { actor_id: A, tag: 'aa' },
        { actor_id: B, tag: 'aa' },
      ],
    });
    const result = await personTagsFor(client, 'solon', 'org:7', [A, B]);
    expect(result).toEqual({ ok: true, tags: { [A]: 'aa', [B]: 'aa' } });
    expect(rpc.mock.calls[0]!.slice(0, 2)).toEqual([
      'identity_person_tags',
      { p_client_id: 'solon', p_scope: 'org:7', p_actor_ids: [A, B] },
    ]);
  });

  it('leaves out an account the database gave no tag, rather than inventing one', async () => {
    const { client } = admin({ data: [{ actor_id: A, tag: 'aa' }] });
    const result = await personTagsFor(client, 'solon', 'org:7', [A, B]);
    expect(result).toEqual({ ok: true, tags: { [A]: 'aa' } });
  });

  it('passes on only actor ids, once each, and does not ask at all when none is one', async () => {
    const { client, rpc } = admin({ data: [] });
    await personTagsFor(client, 'solon', 'org:7', [A, A.toUpperCase(), 'acct_123', '']);
    expect(rpc.mock.calls[0]![1]).toMatchObject({ p_actor_ids: [A] });
    const none = admin();
    expect(await personTagsFor(none.client, 'solon', 'org:7', ['acct_123'])).toEqual({
      ok: true,
      tags: {},
    });
    expect(none.rpc).not.toHaveBeenCalled();
  });

  it('refuses a missing, empty or oversized scope', async () => {
    const { client, rpc } = admin();
    for (const scope of [undefined, '', '   ', 7, 'x'.repeat(201)]) {
      expect(await personTagsFor(client, 'solon', scope, [A])).toEqual({
        ok: false,
        reason: 'invalid_scope',
      });
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it('refuses subjects that are not a list of 1 to 100 strings', async () => {
    const { client, rpc } = admin();
    for (const subjects of [undefined, [], 'x', [A, 5], Array.from({ length: 101 }, () => A)]) {
      expect(await personTagsFor(client, 'solon', 'org:7', subjects)).toEqual({
        ok: false,
        reason: 'invalid_subjects',
      });
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it('reports a database failure as a failure, never as "no tags"', async () => {
    const { client } = admin({ error: { message: 'boom' } });
    expect(await personTagsFor(client, 'solon', 'org:7', [A])).toEqual({
      ok: false,
      reason: 'failed',
    });
  });
});

import { describe, it, expect, vi } from 'vitest';
import { canPerformAction } from '@/services/groups/permissions/resolver';
import type { AnySupabaseClient } from '@/lib/supabase/types';

/**
 * The group permission layer had NO tests at all — not one assertion on the
 * one code path that decides whether a person may spend a group's money or
 * delete it. These are characterization tests: they pin what it does today so
 * the pending merge of the two implementations cannot change any of it by
 * accident.
 *
 * The bug they exist for: `if (!groupId) return { allowed: true }`. The intent
 * was "no group means acting as self", but `!groupId` is also true for the
 * empty string, and three callers take the id straight from a request body.
 * A body carrying `group_id: ""` was an unconditional allow for every action.
 */

function client(group: unknown, membership: unknown): AnySupabaseClient {
  const table = (name: string) => ({
    select: () => ({
      eq: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: membership, error: null }) }),
        maybeSingle: async () => ({ data: group, error: null }),
        single: async () => ({ data: group, error: null }),
      }),
    }),
  });
  return { from: (name: string) => table(name) } as unknown as AnySupabaseClient;
}

const consensusGroup = { governance_preset: 'consensus', voting_threshold: 0.5, is_public: true };

describe('canPerformAction — the permissive branch', () => {
  it('allows a null group: the caller is acting as themselves', async () => {
    const result = await canPerformAction('user-1', null, 'delete_group', client(null, null));
    expect(result.allowed).toBe(true);
  });

  it('REFUSES an empty-string group id instead of allowing everything', async () => {
    const result = await canPerformAction('user-1', '', 'delete_group', client(null, null));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Missing group');
  });

  it('refuses an unauthenticated caller before anything else', async () => {
    const result = await canPerformAction('', 'group-1', 'delete_group', client(null, null));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Not authenticated');
  });
});

describe('canPerformAction — fails closed', () => {
  it('denies when the group cannot be read', async () => {
    const r = await canPerformAction('user-1', 'group-1', 'vote', client(null, null));
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('Group not found');
  });

  it('denies a non-member of a group that exists', async () => {
    const r = await canPerformAction('user-1', 'group-1', 'vote', client(consensusGroup, null));
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('Not a member');
  });

  it('denies an unknown role rather than guessing', async () => {
    const r = await canPerformAction(
      'user-1',
      'group-1',
      'vote',
      client(consensusGroup, { role: 'wizard', permission_overrides: null })
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('Unknown role');
  });

  it('denies an unknown governance preset rather than guessing', async () => {
    const r = await canPerformAction(
      'user-1',
      'group-1',
      'vote',
      client({ governance_preset: 'anarchy' }, { role: 'founder', permission_overrides: null })
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('Unknown governance preset');
  });

  it('denies when the database throws', async () => {
    const throwing = {
      from: () => {
        throw new Error('connection lost');
      },
    } as unknown as AnySupabaseClient;
    const r = await canPerformAction('user-1', 'group-1', 'vote', throwing);
    expect(r.allowed).toBe(false);
  });
});

describe('canPerformAction — permission_overrides', () => {
  const overrides = (value: unknown) =>
    client(consensusGroup, { role: 'member', permission_overrides: { delete_group: value } });

  it("'deny' overrides a preset that would have allowed", async () => {
    const r = await canPerformAction('u', 'g', 'delete_group', overrides('deny'));
    expect(r.allowed).toBe(false);
  });

  it("'allow' overrides a preset that would have denied", async () => {
    const r = await canPerformAction('u', 'g', 'delete_group', overrides('allow'));
    expect(r.allowed).toBe(true);
  });

  it('a value that is not a known permission denies, it does not fall through', async () => {
    const r = await canPerformAction('u', 'g', 'delete_group', overrides('maybe'));
    expect(r.allowed).toBe(false);
  });
});

describe('canPerformAction — vote_required is currently a GRANT', () => {
  /**
   * This is the divergence between the two implementations, pinned rather than
   * endorsed. The resolver returns allowed:true with requiresVote:true, and
   * NOTHING in src/ reads requiresVote — so `vote_required` behaves as `allow`
   * and no proposal is ever raised. checkGroupPermission returns false for the
   * same cell. Whichever way the merge settles this, it should break this test
   * deliberately.
   */
  it('a consensus founder may delete the group, flagged as needing a vote', async () => {
    const r = await canPerformAction(
      'u',
      'g',
      'delete_group',
      client(consensusGroup, { role: 'founder', permission_overrides: null })
    );
    expect(r.allowed).toBe(true);
    expect(r.requiresVote).toBe(true);
  });

  it('no caller anywhere reads requiresVote — it decides nothing today', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          walk(p);
        } else if (/\.tsx?$/.test(name)) {
          files.push(p);
        }
      }
    };
    walk('src');
    const readers = files.filter(
      f =>
        f !== 'src/services/groups/permissions/resolver.ts' &&
        /requiresVote/.test(readFileSync(f, 'utf8'))
    );
    expect(
      readers,
      'Someone now reads requiresVote — governance may actually be enforced; update this test'
    ).toEqual([]);
  });
});

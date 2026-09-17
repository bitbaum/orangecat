import { describe, it, expect, vi } from 'vitest';
import { canPerformAction } from '@/services/groups/permissions/resolver';
import { checkGroupPermission } from '@/services/groups/permissions';
import { DATABASE_TABLES } from '@/config/database-tables';
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

/**
 * The client above ignores the ids it is filtered on, which is fine for the
 * resolver's own tests but useless for the adapter: `checkGroupPermission`
 * takes (groupId, userId) and the resolver takes (userId, groupId), and with a
 * mock that answers every filter identically a swapped wire-up passes. This one
 * honours the filters, so the swap surfaces as "Group not found".
 */
function strictClient(
  expected: { groupId: string; userId: string },
  group: unknown,
  membership: unknown
): AnySupabaseClient {
  const build = (table: string) => {
    const filters: Record<string, unknown> = {};
    const chain = {
      select: () => chain,
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return chain;
      },
      maybeSingle: async () => {
        if (table === DATABASE_TABLES.GROUPS) {
          return { data: filters.id === expected.groupId ? group : null, error: null };
        }
        const matches =
          filters.group_id === expected.groupId && filters.user_id === expected.userId;
        return { data: matches ? membership : null, error: null };
      },
      single: async () => chain.maybeSingle(),
    };
    return chain;
  };
  return { from: (name: string) => build(name) } as unknown as AnySupabaseClient;
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

describe('vote_required is gone, and nothing pretends otherwise', () => {
  /**
   * This block used to pin the divergence: `canPerformAction` returned allowed
   * with `requiresVote: true` while `checkGroupPermission` returned false for
   * the same cell, and NOTHING read the flag — so the only thing enforcing a
   * "vote" was the settings page hiding its delete button, which the API never
   * checked. It was written to break deliberately when that was decided. It has.
   *
   * The 15 cells collapsed to what RLS will actually accept. Deliberation moves
   * to Solon; this file is access control on shared money, nothing more.
   */
  it('a consensus founder may delete the group, with no flag to interpret', async () => {
    const r = await canPerformAction(
      'u',
      'g',
      'delete_group',
      client(consensusGroup, { role: 'founder', permission_overrides: null })
    );
    expect(r.allowed).toBe(true);
    expect(r).not.toHaveProperty('requiresVote');
  });

  it('a consensus MEMBER may not spend the group\u2019s money or change its settings', async () => {
    for (const action of ['spend_funds', 'manage_settings'] as const) {
      const r = await canPerformAction(
        'u',
        'g',
        action,
        client(consensusGroup, { role: 'member', permission_overrides: null })
      );
      expect(r.allowed, `${action} must stay denied for a member`).toBe(false);
    }
  });

  it('every preset cell is now allow or deny — no third state survives', async () => {
    const { GOVERNANCE_PRESETS } = await import('@/config/governance-presets');
    const values = Object.values(GOVERNANCE_PRESETS).flatMap(p =>
      Object.values(p.roles).flatMap(r => Object.values(r))
    );
    expect(values.length).toBe(81);
    expect([...new Set(values)].sort()).toEqual(['allow', 'deny']);
  });
});

describe('checkGroupPermission agrees with canPerformAction, because it IS it', () => {
  /**
   * The point of the merge. There were three implementations of "may this
   * person do this here", and they disagreed: the same founder + delete_group
   * cell was a grant through one and a refusal through another. Two of the
   * three are gone; this pins that the survivor is genuinely an adapter and not
   * a fourth copy that will drift again.
   *
   * Note the swapped argument order — checkGroupPermission takes
   * (groupId, userId), the resolver takes (userId, groupId). Both are strings,
   * so nothing but this test would catch a wire-up that got it backwards.
   */
  const PAIRS = [
    ['canInvite', 'invite_members'],
    ['canManageMembers', 'manage_members'],
    ['canManageWallets', 'spend_funds'],
    ['canCreateProjects', 'create_project'],
    ['canManageSettings', 'manage_settings'],
    ['canDelete', 'delete_group'],
    ['canCreateProposals', 'create_proposal'],
    ['canVote', 'vote'],
  ] as const;

  for (const role of ['founder', 'admin', 'member'] as const) {
    it(`a ${role} gets the same answer from both doors`, async () => {
      for (const [key, action] of PAIRS) {
        const member = { role, permission_overrides: null };
        const ids = { groupId: 'g', userId: 'u' };
        const viaResolver = await canPerformAction(
          'u',
          'g',
          action,
          strictClient(ids, consensusGroup, member)
        );
        const viaAdapter = await checkGroupPermission(
          'g',
          'u',
          key,
          strictClient(ids, consensusGroup, member)
        );
        expect(viaAdapter, `${role}/${key} disagrees with ${action}`).toBe(viaResolver.allowed);
      }
    });
  }

  it('refuses a missing id on either side rather than falling through', async () => {
    const c = client(consensusGroup, { role: 'founder', permission_overrides: null });
    expect(await checkGroupPermission('', 'u', 'canDelete', c)).toBe(false);
    expect(await checkGroupPermission('g', '', 'canDelete', c)).toBe(false);
  });
});

describe('canView and canJoin — visibility, which no preset can express', () => {
  /**
   * These two are the only keys the adapter still answers itself, because
   * RolePermissions has no cell for either. They were also the easiest thing to
   * get subtly wrong while merging, so they are pinned against the behaviour
   * the old implementation actually had — including the case it got right by
   * accident: a member asking `canJoin` got false, because the lookup key
   * 'join' does not exist in any preset.
   */
  const ids = { groupId: 'g', userId: 'u' };
  const publicGroup = { governance_preset: 'consensus', is_public: true };
  const privateGroup = { governance_preset: 'consensus', is_public: false };
  const member = { role: 'member', permission_overrides: null };

  const check = (group: unknown, membership: unknown, key: 'canView' | 'canJoin') =>
    checkGroupPermission('g', 'u', key, strictClient(ids, group, membership));

  it('lets anyone view a public group, member or not', async () => {
    expect(await check(publicGroup, null, 'canView')).toBe(true);
    expect(await check(publicGroup, member, 'canView')).toBe(true);
  });

  it('lets only members view a private group', async () => {
    expect(await check(privateGroup, null, 'canView')).toBe(false);
    expect(await check(privateGroup, member, 'canView')).toBe(true);
  });

  it('lets a stranger join a public group', async () => {
    expect(await check(publicGroup, null, 'canJoin')).toBe(true);
  });

  it('does NOT let an existing member join again', async () => {
    expect(await check(publicGroup, member, 'canJoin')).toBe(false);
  });

  it('lets nobody join a private group', async () => {
    expect(await check(privateGroup, null, 'canJoin')).toBe(false);
    expect(await check(privateGroup, member, 'canJoin')).toBe(false);
  });

  it('denies both when the group cannot be read at all', async () => {
    expect(await check(null, null, 'canView')).toBe(false);
    expect(await check(null, null, 'canJoin')).toBe(false);
  });
});

/**
 * A "Members only" group promises "Only members can see content", and its
 * settings say "Listed, but only members see content". The reads only asked
 * whether the group was listed, so on 2026-11-12 a listed members-only group
 * showed its member list to a signed-out visitor.
 *
 * These pin the one rule (utils/visibility) and the signed-out service reads
 * that apply it: a listed group is not an open group.
 */

import { describe, it, expect } from 'vitest';
import { canSeeGroupContent, groupContentIsOpen } from '@/services/groups/utils/visibility';
import { getGroupMembers } from '@/services/groups/queries/members';
import { getGroupActivities } from '@/services/groups/queries/activities';
import { DATABASE_TABLES } from '@/config/database-tables';
import type { AnySupabaseClient } from '@/lib/supabase/types';

describe('groupContentIsOpen: listed AND public, nothing less', () => {
  it('opens only a listed group whose visibility is public', () => {
    expect(groupContentIsOpen({ is_public: true, visibility: 'public' })).toBe(true);
  });

  it('keeps a LISTED members-only group closed', () => {
    expect(groupContentIsOpen({ is_public: true, visibility: 'members_only' })).toBe(false);
  });

  it('keeps private, unlisted and unknown-visibility groups closed', () => {
    expect(groupContentIsOpen({ is_public: true, visibility: 'private' })).toBe(false);
    expect(groupContentIsOpen({ is_public: false, visibility: 'public' })).toBe(false);
    expect(groupContentIsOpen({ is_public: true, visibility: null })).toBe(false);
    expect(groupContentIsOpen({ is_public: true })).toBe(false);
  });

  it('always shows a member their own group', () => {
    expect(canSeeGroupContent({ is_public: true, visibility: 'members_only' }, true)).toBe(true);
    expect(canSeeGroupContent({ is_public: false, visibility: 'private' }, true)).toBe(true);
    expect(canSeeGroupContent({ is_public: true, visibility: 'members_only' }, false)).toBe(false);
  });
});

/**
 * A signed-out client: no user, the group row as given, and a record of every
 * table asked for, so a read that should never happen is visible.
 */
function signedOutClient(group: Record<string, unknown>) {
  const asked: string[] = [];
  const rows = [{ id: 'm1', group_id: 'g1', user_id: 'founder', role: 'founder' }];
  const chain = (table: string) => {
    asked.push(table);
    const c: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'range', 'gte', 'lte']) {
      c[m] = () => c;
    }
    c.single = async () => ({ data: table === DATABASE_TABLES.GROUPS ? group : null, error: null });
    c.then = (resolve: (v: unknown) => unknown) =>
      resolve({ data: rows, error: null, count: rows.length });
    return c;
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    from: (table: string) => chain(table),
  } as unknown as AnySupabaseClient;
  return { client, asked };
}

describe('signed-out reads of a listed members-only group', () => {
  const membersOnly = { is_public: true, visibility: 'members_only' };
  const open = { is_public: true, visibility: 'public' };

  it('getGroupMembers refuses and never reads group_members', async () => {
    const { client, asked } = signedOutClient(membersOnly);
    const result = await getGroupMembers('g1', undefined, client);
    expect(result.success).toBe(false);
    expect(asked).not.toContain(DATABASE_TABLES.GROUP_MEMBERS);
  });

  it('getGroupActivities refuses and never reads group_activities', async () => {
    const { client, asked } = signedOutClient(membersOnly);
    const result = await getGroupActivities('g1', undefined, undefined, client);
    expect(result.success).toBe(false);
    expect(asked).not.toContain(DATABASE_TABLES.GROUP_ACTIVITIES);
  });

  it('still lists the members of an open group', async () => {
    const { client, asked } = signedOutClient(open);
    const result = await getGroupMembers('g1', undefined, client);
    expect(result.success).toBe(true);
    expect(asked).toContain(DATABASE_TABLES.GROUP_MEMBERS);
  });
});

/**
 * Joining a group goes through join_public_group. The direct group_members
 * insert it used to make was forbidden by that table's policy for anyone but a
 * group's founders and admins, so "Join Group" could never succeed and showed
 * Postgres' row-level-security text instead (live review 2026-11-12).
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/browser', () => ({ default: {} }));

import { joinGroup } from '@/services/groups/mutations/members';
import { groupIsOpenToJoin } from '@/services/groups/utils/joining';
import type { AnySupabaseClient } from '@/lib/supabase/types';

function client(userId: string | null, rpcResult: { data?: unknown; error?: unknown }) {
  const inserts: Array<{ table: string; row: unknown }> = [];
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null, ...rpcResult });
  const from = vi.fn((table: string) => ({
    insert: vi.fn(async (row: unknown) => {
      inserts.push({ table, row });
      return { error: null };
    }),
    select: () => ({
      eq: () => ({
        single: async () => ({ data: { is_public: true, visibility: 'public' }, error: null }),
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
  }));
  const auth = { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) };
  return {
    sb: { rpc, from, auth } as unknown as AnySupabaseClient,
    rpc,
    inserts,
  };
}

describe('joinGroup', () => {
  it('joins through join_public_group and never inserts a membership itself', async () => {
    const { sb, rpc, inserts } = client('u1', { data: { success: true, group_id: 'g1' } });
    const result = await joinGroup('g1', sb);

    expect(result).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith('join_public_group', { p_group_id: 'g1' });
    expect(inserts.filter(i => i.table === 'group_members')).toEqual([]);
    // The join is recorded once, by the service.
    expect(inserts.filter(i => i.table === 'group_activities')).toHaveLength(1);
  });

  it("passes on the function's refusal in its own words", async () => {
    const { sb, inserts } = client('u1', {
      data: { success: false, error: 'This group takes new members by invitation only' },
    });
    const result = await joinGroup('g1', sb);

    expect(result).toEqual({
      success: false,
      error: 'This group takes new members by invitation only',
    });
    expect(inserts).toEqual([]);
  });

  it("carries the function's refusal code, so the route can answer 403/409", async () => {
    const { sb } = client('u1', {
      data: {
        success: false,
        code: 'already_member',
        error: 'You are already a member of this group',
      },
    });
    expect(await joinGroup('g1', sb)).toEqual({
      success: false,
      error: 'You are already a member of this group',
      refusal: 'already_member',
    });
  });

  it('never invents a refusal from an unknown code or a database error', async () => {
    const unknown = await joinGroup('g1', client('u1', { data: { success: false, code: 'x' } }).sb);
    expect(unknown.refusal).toBeUndefined();
    const broken = await joinGroup('g1', client('u1', { error: { message: 'boom' } }).sb);
    expect(broken.refusal).toBeUndefined();
  });

  it('never shows a database error to the person', async () => {
    const { sb } = client('u1', {
      error: { message: 'new row violates row-level security policy for table "group_members"' },
    });
    const result = await joinGroup('g1', sb);

    expect(result.success).toBe(false);
    expect(result.error).not.toMatch(/row-level security|group_members/);
  });

  it('asks a signed-out person to sign in, without calling the database', async () => {
    const { sb, rpc } = client(null, {});
    const result = await joinGroup('g1', sb);

    expect(result).toEqual({
      success: false,
      error: 'Sign in to join this group',
      refusal: 'not_signed_in',
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('groupIsOpenToJoin — the rule join_public_group holds in SQL', () => {
  it('is open only when listed and public', () => {
    expect(groupIsOpenToJoin({ is_public: true, visibility: 'public' })).toBe(true);
    expect(groupIsOpenToJoin({ is_public: true, visibility: 'members_only' })).toBe(false);
    expect(groupIsOpenToJoin({ is_public: false, visibility: 'private' })).toBe(false);
    expect(groupIsOpenToJoin({ is_public: false, visibility: 'public' })).toBe(false);
    expect(groupIsOpenToJoin({ is_public: true, visibility: null })).toBe(false);
    expect(groupIsOpenToJoin({})).toBe(false);
  });
});

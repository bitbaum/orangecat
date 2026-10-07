/**
 * Answering an invitation goes through the database functions: the direct
 * group_members insert it used to make was forbidden by that table's policy,
 * so accepting never worked (audit 2026-10-07).
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: () => ({}) }));

import { respondToInvitation } from '@/domain/groups/invitations.server';

function client(rpcResult: unknown, slug = 'bike-club') {
  const rpc = vi.fn().mockResolvedValue({ data: rpcResult, error: null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: { slug } });
  const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }));
  return { rpc, from } as unknown as Parameters<typeof respondToInvitation>[0] & {
    rpc: typeof rpc;
  };
}

describe('respondToInvitation', () => {
  it('accepts through accept_group_invitation and returns the group to open', async () => {
    const supabase = client({ success: true, group_id: 'g1' });
    const result = await respondToInvitation(supabase, 'inv-1', 'u1', 'accept');
    expect(supabase.rpc).toHaveBeenCalledWith('accept_group_invitation', {
      invitation_id: 'inv-1',
    });
    expect(result).toMatchObject({ ok: true, group_slug: 'bike-club' });
  });

  it("answers someone else's invitation as not found", async () => {
    const supabase = client({ success: false, error: 'Invitation not found' });
    const result = await respondToInvitation(supabase, 'inv-1', 'u2', 'accept');
    expect(result).toMatchObject({ ok: false, code: 'not_found' });
  });

  it('declines through decline_group_invitation', async () => {
    const supabase = client({ success: true, group_id: 'g1' });
    const result = await respondToInvitation(supabase, 'inv-1', 'u1', 'decline');
    expect(supabase.rpc).toHaveBeenCalledWith('decline_group_invitation', {
      invitation_id: 'inv-1',
    });
    expect(result).toMatchObject({ ok: true, message: 'Invitation declined' });
  });
});

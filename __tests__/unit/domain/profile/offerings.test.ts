import { describe, expect, it, vi } from 'vitest';
import { getOwnOfferings, setOwnOfferingsSharing } from '@/domain/profile/offerings';
import type { AnySupabaseClient } from '@/lib/supabase/types';

function database(row: Record<string, unknown> | null, error: unknown = null) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: row, error }),
    single: vi.fn().mockResolvedValue({ data: row, error }),
  };
  return {
    client: { from: vi.fn().mockReturnValue(query) } as unknown as AnySupabaseClient,
    query,
  };
}

describe('owner-controlled economic offerings', () => {
  it('reads only the owner and defaults missing offerings to private', async () => {
    const { client, query } = database(null);
    expect(await getOwnOfferings(client, 'owner')).toMatchObject({ enabled: false });
    expect(query.eq).toHaveBeenCalledWith('user_id', 'owner');
  });

  it('changes only the sharing flag and never exposes private economic fields', async () => {
    const { client, query } = database({
      public_offerings_enabled: true,
      skills: [{ name: 'Carpentry' }],
      constraints: ['private constraint'],
      motivation: 'private motive',
      goals: ['private goal'],
    });
    const result = await setOwnOfferingsSharing(client, 'owner', true);
    expect(query.upsert).toHaveBeenCalledWith(
      { user_id: 'owner', public_offerings_enabled: true },
      { onConflict: 'user_id' }
    );
    expect(result).toEqual({
      enabled: true,
      offerings: { skills: [{ name: 'Carpentry' }], assets: [], askedFor: [], notAvailableFor: [] },
    });
    expect(JSON.stringify(result)).not.toContain('private');
  });

  it('surfaces database failure instead of reporting private or a successful change', async () => {
    const { client } = database(null, new Error('unavailable'));
    await expect(getOwnOfferings(client, 'owner')).rejects.toThrow('unavailable');
    await expect(setOwnOfferingsSharing(client, 'owner', false)).rejects.toThrow('unavailable');
  });
});

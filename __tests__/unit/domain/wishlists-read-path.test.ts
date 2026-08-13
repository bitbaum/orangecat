import { listWishlistsPage } from '@/domain/wishlists/service';
import { createServerClient } from '@/lib/supabase/server';
import { getUserActorId } from '@/domain/actors';

jest.mock('@/lib/supabase/server', () => ({ createServerClient: jest.fn() }));
jest.mock('@/domain/actors', () => ({ getUserActorId: jest.fn() }));

describe('wishlist list read path', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns an empty page without provisioning when the user has no actor', async () => {
    const query = { select: jest.fn().mockReturnThis() };
    (createServerClient as jest.Mock).mockResolvedValue({
      from: jest.fn().mockReturnValue(query),
    });
    (getUserActorId as jest.Mock).mockResolvedValue(null);

    await expect(listWishlistsPage(20, 0, 'user-1', true)).resolves.toEqual({
      items: [],
      total: 0,
    });
    expect(getUserActorId).toHaveBeenCalledWith(expect.anything(), 'user-1');
    expect(query.select).toHaveBeenCalledTimes(1);
  });

  it('filters wishlist ownership in actor UUID space', async () => {
    const result = { data: [{ id: 'wishlist-1', item_count: 2 }], count: 1, error: null };
    const query: Record<string, jest.Mock | ((resolve: (value: unknown) => void) => void)> = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      then: resolve => Promise.resolve(result).then(resolve),
    };
    (createServerClient as jest.Mock).mockResolvedValue({
      from: jest.fn().mockReturnValue(query),
    });
    (getUserActorId as jest.Mock).mockResolvedValue('actor-1');

    const page = await listWishlistsPage(20, 0, 'user-1', true);

    expect(query.eq).toHaveBeenCalledWith('actor_id', 'actor-1');
    expect(query.eq).not.toHaveBeenCalledWith('actor_id', 'user-1');
    expect(page).toEqual({
      items: [{ id: 'wishlist-1', item_count: 2, items_count: 2 }],
      total: 1,
    });
  });
});

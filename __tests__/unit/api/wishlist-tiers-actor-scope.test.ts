import { GET } from '@/app/api/profiles/[userId]/wishlist-tiers/route';
import { getUserActorId } from '@/domain/actors';

jest.mock('@/lib/api/withAuth', () => ({
  withOptionalAuth: (handler: (request: unknown, context: unknown) => Promise<unknown>) => handler,
}));
jest.mock('@/domain/actors', () => ({ getUserActorId: jest.fn() }));
jest.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: jest.fn((data: unknown) => ({ status: 200, data })),
  apiInternalError: jest.fn(() => ({ status: 500 })),
}));

describe('GET /api/profiles/[userId]/wishlist-tiers actor scope', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolves the profile UUID and filters the joined wishlist by actor UUID', async () => {
    const result = { data: [{ id: 'item-1' }], error: null };
    const query: Record<string, jest.Mock | ((resolve: (value: unknown) => void) => void)> = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      then: resolve => Promise.resolve(result).then(resolve),
    };
    const supabase = { from: jest.fn().mockReturnValue(query) };
    (getUserActorId as jest.Mock).mockResolvedValue('actor-1');

    const response = (await GET(
      { supabase } as never,
      { params: Promise.resolve({ userId: '00000000-0000-4000-8000-000000000001' }) } as never
    )) as unknown as { status: number; data: unknown };

    expect(response.status).toBe(200);
    expect(getUserActorId).toHaveBeenCalledWith(
      supabase,
      '00000000-0000-4000-8000-000000000001'
    );
    expect(query.eq).toHaveBeenCalledWith('wishlists.actor_id', 'actor-1');
    expect(query.eq).not.toHaveBeenCalledWith(
      'wishlists.actor_id',
      '00000000-0000-4000-8000-000000000001'
    );
  });

  it('returns an empty tier set when the user has no actor', async () => {
    const supabase = { from: jest.fn() };
    (getUserActorId as jest.Mock).mockResolvedValue(null);

    const response = (await GET(
      { supabase } as never,
      { params: Promise.resolve({ userId: '00000000-0000-4000-8000-000000000001' }) } as never
    )) as unknown as { data: unknown };

    expect(response.data).toEqual({ items: [] });
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

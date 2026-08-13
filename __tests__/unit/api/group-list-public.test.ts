import { GET } from '@/app/api/groups/route';
import { getAvailableGroups, getUserGroups } from '@/services/groups/queries/groups';

jest.mock('@/lib/api/withAuth', () => ({
  withOptionalAuth: (handler: (request: unknown) => Promise<unknown>) => handler,
  withAuth: (handler: (request: unknown) => Promise<unknown>) => handler,
}));
jest.mock('@/services/groups/queries/groups', () => ({
  getAvailableGroups: jest.fn(),
  getUserGroups: jest.fn(),
}));
jest.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: jest.fn(),
  retryAfterSeconds: jest.fn(),
}));
jest.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: jest.fn((data: unknown) => ({ status: 200, data })),
  apiInternalError: jest.fn(() => ({ status: 500 })),
  apiCreated: jest.fn(),
  apiBadRequest: jest.fn(),
  apiRateLimited: jest.fn(),
}));

describe('GET /api/groups list access', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns public groups to anonymous discovery clients', async () => {
    const supabase = {};
    (getAvailableGroups as jest.Mock).mockResolvedValue({
      success: true,
      groups: [{ id: 'group-1', slug: 'garden', is_public: true }],
      total: 1,
    });

    const response = (await GET({
      nextUrl: new URL('https://orangecat.test/api/groups?limit=100'),
      user: null,
      supabase,
    } as never)) as unknown as { status: number; data: { groups: unknown[]; total: number } };

    expect(response.status).toBe(200);
    expect(getAvailableGroups).toHaveBeenCalledWith(
      { is_public: true },
      { page: 1, pageSize: 100 },
      supabase
    );
    expect(getUserGroups).not.toHaveBeenCalled();
    expect(response.data.total).toBe(1);
  });

  it('keeps the signed-in endpoint scoped to memberships', async () => {
    const supabase = {};
    (getUserGroups as jest.Mock).mockResolvedValue({ success: true, groups: [], total: 0 });

    await GET({
      nextUrl: new URL('https://orangecat.test/api/groups'),
      user: { id: 'user-1' },
      supabase,
    } as never);

    expect(getUserGroups).toHaveBeenCalledWith({}, { page: 1, pageSize: 20 }, supabase);
    expect(getAvailableGroups).not.toHaveBeenCalled();
  });

  it('lets a signed-in discovery client explicitly request the public catalogue', async () => {
    const supabase = {};
    (getAvailableGroups as jest.Mock).mockResolvedValue({ success: true, groups: [], total: 0 });

    await GET({
      nextUrl: new URL('https://orangecat.test/api/groups?scope=public'),
      user: { id: 'user-1' },
      supabase,
    } as never);

    expect(getAvailableGroups).toHaveBeenCalledWith(
      { is_public: true },
      { page: 1, pageSize: 20 },
      supabase
    );
    expect(getUserGroups).not.toHaveBeenCalled();
  });
});

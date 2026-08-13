import { GET } from '@/app/api/groups/[slug]/proposals/route';
import { getGroup } from '@/services/groups/queries/groups';
import { getGroupProposals } from '@/services/groups/queries/proposals';

jest.mock('@/lib/api/withAuth', () => ({
  withOptionalAuth: (handler: (request: unknown, context: unknown) => Promise<unknown>) => handler,
  withAuth: (handler: (request: unknown, context: unknown) => Promise<unknown>) => handler,
}));
jest.mock('@/services/groups/queries/groups', () => ({ getGroup: jest.fn() }));
jest.mock('@/services/groups/queries/proposals', () => ({
  getGroupProposals: jest.fn(),
}));
jest.mock('@/services/groups/mutations/proposals', () => ({ createProposal: jest.fn() }));
jest.mock('@/services/groups/activities', () => ({ recordGroupActivity: jest.fn() }));
jest.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: jest.fn(),
  retryAfterSeconds: jest.fn(),
}));
jest.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: jest.fn((data: unknown) => ({ status: 200, data })),
  apiUnauthorized: jest.fn(() => ({ status: 401 })),
  apiNotFound: jest.fn(() => ({ status: 404 })),
  apiInternalError: jest.fn(() => ({ status: 500 })),
  apiBadRequest: jest.fn(() => ({ status: 400 })),
  apiCreated: jest.fn(),
  apiRateLimited: jest.fn(),
  handleApiError: jest.fn(() => ({ status: 500 })),
}));

describe('GET /api/groups/[slug]/proposals request client', () => {
  it('passes the request-scoped client through both read services', async () => {
    const supabase = {};
    (getGroup as jest.Mock).mockResolvedValue({
      success: true,
      group: { id: 'group-1', is_public: true },
    });
    (getGroupProposals as jest.Mock).mockResolvedValue({
      success: true,
      proposals: [{ id: 'proposal-1', is_public: true }],
      total: 1,
    });
    const request = {
      user: null,
      supabase,
      nextUrl: new URL('https://orangecat.test/api/groups/garden/proposals?status=all'),
    };

    const response = (await GET(request as never, {
      params: Promise.resolve({ slug: 'garden' }),
    } as never)) as unknown as { status: number };

    expect(response.status).toBe(200);
    expect(getGroup).toHaveBeenCalledWith('garden', true, supabase);
    expect(getGroupProposals).toHaveBeenCalledWith(
      'group-1',
      expect.objectContaining({ status: 'all' }),
      supabase
    );
  });
});

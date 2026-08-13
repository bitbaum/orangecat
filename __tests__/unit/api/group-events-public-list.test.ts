import { GET } from '@/app/api/groups/[slug]/events/route';

jest.mock('@/lib/supabase/server', () => ({ createServerClient: jest.fn() }));

jest.mock('@/domain/groups/helpers.server', () => ({
  resolveGroupBySlug: jest.fn(),
  checkGroupMember: jest.fn(),
}));

jest.mock('@/services/groups/eventProfiles', () => ({
  attachEventProfiles: jest.fn(async (_supabase: unknown, events: unknown[]) => events),
  fetchProfilesMap: jest.fn(),
}));

jest.mock('@/services/groups/activities', () => ({ recordGroupActivity: jest.fn() }));

jest.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: jest.fn(),
  retryAfterSeconds: jest.fn(),
}));

jest.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: jest.fn((data: unknown) => ({
    status: 200,
    json: async () => ({ success: true, data }),
  })),
  apiNotFound: jest.fn((message = 'Not found') => ({
    status: 404,
    json: async () => ({ success: false, error: { message } }),
  })),
  apiCreated: jest.fn(),
  apiForbidden: jest.fn(),
  apiValidationError: jest.fn(),
  apiRateLimited: jest.fn(),
  handleApiError: jest.fn(() => ({ status: 500, json: async () => ({ success: false }) })),
}));

import { createServerClient } from '@/lib/supabase/server';
import { resolveGroupBySlug } from '@/domain/groups/helpers.server';

function chain(events: unknown[] = []) {
  const query: Record<string, jest.Mock | ((resolve: (value: unknown) => void) => void)> = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => void) =>
      Promise.resolve({ data: events, count: events.length, error: null }).then(resolve),
  };
  return query as any;
}

describe('GET /api/groups/[slug]/events public contract', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lets anonymous visitors list only public events for a public group', async () => {
    const query = chain([{ id: 'event-1', is_public: true }]);
    const supabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
      from: jest.fn().mockReturnValue(query),
    };
    (createServerClient as jest.Mock).mockResolvedValue(supabase);
    (resolveGroupBySlug as jest.Mock).mockResolvedValue({ id: 'group-1', is_public: true });

    const response = await GET(
      { url: 'https://orangecat.test/api/groups/garden/events?status=all' } as any,
      { params: Promise.resolve({ slug: 'garden' }) }
    );

    expect(response.status).toBe(200);
    expect(query.eq).toHaveBeenCalledWith('group_id', 'group-1');
    expect(query.eq).toHaveBeenCalledWith('is_public', true);
  });

  it('does not expose a private group through the anonymous event list', async () => {
    const query = chain();
    const supabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
      from: jest.fn().mockReturnValue(query),
    };
    (createServerClient as jest.Mock).mockResolvedValue(supabase);
    (resolveGroupBySlug as jest.Mock).mockResolvedValue({ id: 'group-1', is_public: false });

    const response = await GET(
      { url: 'https://orangecat.test/api/groups/private/events?status=all' } as any,
      { params: Promise.resolve({ slug: 'private' }) }
    );

    expect(response.status).toBe(404);
  });

  it('keeps the authenticated member query unfiltered by public visibility', async () => {
    const query = chain([{ id: 'private-event', is_public: false }]);
    const supabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'member-1' } } }) },
      from: jest.fn().mockReturnValue(query),
    };
    (createServerClient as jest.Mock).mockResolvedValue(supabase);
    (resolveGroupBySlug as jest.Mock).mockResolvedValue({ id: 'group-1', is_public: false });

    const response = await GET(
      { url: 'https://orangecat.test/api/groups/private/events?status=all' } as any,
      { params: Promise.resolve({ slug: 'private' }) }
    );

    expect(response.status).toBe(200);
    expect(query.eq).not.toHaveBeenCalledWith('is_public', true);
  });
});

import { GET, PUT } from '@/app/api/projects/[id]/route';

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: vi.fn((data: unknown) => ({
    status: 200,
    json: async () => ({ success: true, data }),
  })),
  apiUnauthorized: vi.fn((message = 'Unauthorized') => ({
    status: 401,
    json: async () => ({ success: false, error: { message } }),
  })),
  apiNotFound: vi.fn((message = 'Not found') => ({
    status: 404,
    json: async () => ({ success: false, error: { message } }),
  })),
  apiValidationError: vi.fn((message = 'Validation failed') => ({
    status: 400,
    json: async () => ({ success: false, error: { message } }),
  })),
  handleApiError: vi.fn(() => ({
    status: 500,
    json: async () => ({ success: false, error: { message: 'Internal error' } }),
  })),
  handleSupabaseError: vi.fn(() => ({
    status: 500,
    json: async () => ({ success: false, error: { message: 'DB error' } }),
  })),
  apiForbidden: vi.fn((message = 'Forbidden') => ({
    status: 403,
    json: async () => ({ success: false, error: { message } }),
  })),
  apiRateLimited: vi.fn(() => ({
    status: 429,
    json: async () => ({ success: false, error: { message: 'Rate limited' } }),
  })),
  apiBadRequest: vi.fn((message = 'Bad request') => ({
    status: 400,
    json: async () => ({ success: false, error: { message } }),
  })),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
  rateLimitWriteAsync: vi.fn(),
  createRateLimitResponse: vi.fn(() => new Response('rate limited', { status: 429 })),
  applyRateLimitHeaders: vi.fn((response: Response) => response),
}));

vi.mock('@/services/actors', () => ({
  checkOwnership: vi.fn(),
}));

vi.mock('@/services/actors/getOrCreateUserActor', () => ({
  getOrCreateUserActor: vi.fn().mockResolvedValue({ id: 'a1' }),
}));

vi.mock('@/lib/api/auditLog', () => ({
  auditSuccess: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: {
    PROJECT_CREATED: 'project_created',
  },
}));

import { createServerClient } from '@/lib/supabase/server';
import { checkOwnership } from '@/services/actors';
import { rateLimit, rateLimitWriteAsync } from '@/lib/rate-limit';

import type { Mock } from 'vitest';

describe('Project [id] API workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (rateLimit as Mock).mockResolvedValue({ success: true });
    (rateLimitWriteAsync as Mock).mockResolvedValue({
      success: true,
      resetTime: Date.now() + 60000,
    });
    (checkOwnership as Mock).mockResolvedValue(true);
  });

  it('GET returns project detail with profile mapping', async () => {
    const project = {
      id: '00000000-0000-0000-0000-000000000001',
      user_id: 'u1',
      title: 'Project One',
      raised_amount: null,
      status: 'active',
    };
    const profile = {
      id: 'u1',
      username: 'alice',
      name: 'Alice',
      avatar_url: null,
      email: 'alice@test.dev',
    };

    const projectQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: project, error: null }),
    } as any;

    const profileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
    } as any;

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi
        .fn()
        .mockImplementationOnce(() => projectQuery)
        .mockImplementationOnce(() => profileQuery),
    };

    (createServerClient as Mock).mockResolvedValue(supabase);

    const request = {};
    const response = await GET(request as any, {
      params: { id: '00000000-0000-0000-0000-000000000001' },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('00000000-0000-0000-0000-000000000001');
    expect(body.data.raised_amount).toBe(0);
    expect(body.data.profiles.username).toBe('alice');
  });

  it('PUT updates own project', async () => {
    const existing = {
      id: '00000000-0000-0000-0000-000000000001',
      user_id: 'u1',
      actor_id: 'a1',
      title: 'Old Title',
    };

    const updated = {
      ...existing,
      title: 'Updated Title',
    };

    const fetchQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: existing, error: null }),
    } as any;

    const updateQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updated, error: null }),
    } as any;

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
      },
      from: vi
        .fn()
        .mockImplementationOnce(() => fetchQuery)
        .mockImplementationOnce(() => updateQuery),
    };

    (createServerClient as Mock).mockResolvedValue(supabase);

    const request = {
      json: vi.fn().mockResolvedValue({
        title: 'Updated Title',
        description: 'Updated description',
      }),
    };

    const response = await PUT(request as any, {
      params: { id: '00000000-0000-0000-0000-000000000001' },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('Updated Title');
  });

  it('PUT rejects updates to project owned by another user', async () => {
    (checkOwnership as Mock).mockResolvedValueOnce(false);
    const existing = {
      id: '00000000-0000-0000-0000-000000000001',
      user_id: 'someone-else',
      actor_id: 'other-actor',
      title: 'Locked Project',
    };

    const fetchQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: existing, error: null }),
    } as any;

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
      },
      from: vi.fn().mockImplementation(() => fetchQuery),
    };

    (createServerClient as Mock).mockResolvedValue(supabase);

    const request = {
      json: vi.fn().mockResolvedValue({ title: 'Should Not Update' }),
    };

    const response = await PUT(request as any, {
      params: { id: '00000000-0000-0000-0000-000000000001' },
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
  });
});

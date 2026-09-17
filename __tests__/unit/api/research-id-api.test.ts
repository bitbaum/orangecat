/**
 * Research [id] API route tests
 *
 * Research entities use user_id (profiles FK) for ownership, unlike all other
 * entities which use actor_id. Tests verify GET visibility rules, PUT ownership
 * enforcement, and DELETE guards against funded entities.
 */

import { GET, PUT, DELETE } from '@/app/api/research/[id]/route';

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
  apiForbidden: vi.fn((message = 'Forbidden') => ({
    status: 403,
    json: async () => ({ success: false, error: { message } }),
  })),
  apiBadRequest: vi.fn((message = 'Bad request') => ({
    status: 400,
    json: async () => ({ success: false, error: { message } }),
  })),
  apiRateLimited: vi.fn(() => ({
    status: 429,
    json: async () => ({ success: false, error: { message: 'Rate limited' } }),
  })),
  handleApiError: vi.fn(() => ({
    status: 500,
    json: async () => ({ success: false, error: { message: 'Internal error' } }),
  })),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: vi.fn().mockResolvedValue({
    success: true,
    resetTime: Date.now() + 60000,
  }),
}));

import { createServerClient } from '@/lib/supabase/server';
import { rateLimitWriteAsync } from '@/lib/rate-limit';

import type { Mock } from 'vitest';

const RESEARCH_ID = '00000000-0000-0000-0000-000000000001';
const OWNER_USER_ID = 'user-owner-001';
const OTHER_USER_ID = 'user-other-002';

/** Build a minimal valid research entity */
function makeResearch(overrides: Record<string, unknown> = {}) {
  return {
    id: RESEARCH_ID,
    user_id: OWNER_USER_ID,
    title: 'Decentralized Finance Impact Study',
    is_public: true,
    funding_goal_btc: 0.5,
    funding_raised_btc: 0,
    status: 'draft',
    ...overrides,
  };
}

/** Build a Supabase mock that returns the given research entity */
function makeSupabase(userId: string, entity: Record<string, unknown> | null) {
  const single = vi.fn().mockResolvedValue({
    data: entity,
    error: entity ? null : { code: 'PGRST116' },
  });
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single,
  } as any;

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }),
    },
    from: vi.fn().mockReturnValue(query),
    _query: query,
  };
}

const makeParams = (id = RESEARCH_ID) => ({ params: Promise.resolve({ id }) });

describe('Research [id] API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (rateLimitWriteAsync as Mock).mockResolvedValue({
      success: true,
      resetTime: Date.now() + 60000,
    });
  });

  describe('GET — visibility rules', () => {
    it('returns public research to anonymous visitors', async () => {
      const entity = makeResearch({ is_public: true });

      // GET uses withOptionalAuth — no user returned for anonymous
      const supabase = makeSupabase('', entity);
      // withOptionalAuth may return user: null; mock returns empty user
      supabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null });
      // Also need related data mocks (progress_updates, votes, contributions)
      supabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: entity, error: null }),
      });

      (createServerClient as Mock).mockResolvedValue(supabase);

      const response = await GET({} as any, makeParams());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('blocks access to private research for non-owner', async () => {
      const entity = makeResearch({ is_public: false, user_id: OWNER_USER_ID });
      const supabase = makeSupabase(OTHER_USER_ID, entity);
      supabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: entity, error: null }),
      });

      (createServerClient as Mock).mockResolvedValue(supabase);

      const response = await GET({} as any, makeParams());
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.success).toBe(false);
    });

    it('returns 404 when research does not exist', async () => {
      const supabase = makeSupabase(OWNER_USER_ID, null);
      supabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      });

      (createServerClient as Mock).mockResolvedValue(supabase);

      const response = await GET({} as any, makeParams());
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.success).toBe(false);
    });
  });

  describe('PUT — user_id ownership (not actor_id)', () => {
    const validUpdate = {
      title: 'Updated Research Title Here',
      description: 'Updated description of the research methodology and expected outcomes.',
      field: 'economics',
      methodology: 'computational',
    };

    it('owner can update their own research entity', async () => {
      const existing = makeResearch();
      const updated = { ...existing, title: validUpdate.title };

      // verifyResearchOwner does a select query, update does another
      let callCount = 0;
      const supabase = {
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: OWNER_USER_ID } }, error: null }),
        },
        from: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // verifyResearchOwner: returns entity with user_id
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: existing, error: null }),
            };
          }
          // update call
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: updated, error: null }),
          };
        }),
      };

      (createServerClient as Mock).mockResolvedValue(supabase);

      const response = await PUT(
        { json: vi.fn().mockResolvedValue(validUpdate) } as any,
        makeParams()
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.title).toBe(validUpdate.title);
    });

    it('rejects update from a different user (user_id mismatch)', async () => {
      const existing = makeResearch({ user_id: OWNER_USER_ID });

      const supabase = {
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: OTHER_USER_ID } }, error: null }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: existing, error: null }),
        }),
      };

      (createServerClient as Mock).mockResolvedValue(supabase);

      const response = await PUT(
        { json: vi.fn().mockResolvedValue(validUpdate) } as any,
        makeParams()
      );
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.success).toBe(false);
    });
  });

  describe('DELETE — guards funded research', () => {
    it('allows deletion of unfunded research by owner', async () => {
      const existing = makeResearch({ funding_raised_btc: 0 });

      let callCount = 0;
      const supabase = {
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: OWNER_USER_ID } }, error: null }),
        },
        from: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: existing, error: null }),
            };
          }
          return {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
          };
        }),
      };

      (createServerClient as Mock).mockResolvedValue(supabase);

      const response = await DELETE({} as any, makeParams());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('blocks deletion of funded research', async () => {
      const existing = makeResearch({ funding_raised_btc: 0.1 });

      const supabase = {
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: OWNER_USER_ID } }, error: null }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: existing, error: null }),
        }),
      };

      (createServerClient as Mock).mockResolvedValue(supabase);

      const response = await DELETE({} as any, makeParams());
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.success).toBe(false);
    });
  });
});

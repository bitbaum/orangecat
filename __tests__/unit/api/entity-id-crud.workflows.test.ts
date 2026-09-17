import { GET as getService, PUT as putService } from '@/app/api/services/[id]/route';
import { GET as getProduct, PUT as putProduct } from '@/app/api/products/[id]/route';
import { GET as getCause, PUT as putCause } from '@/app/api/causes/[id]/route';

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

vi.mock('@/services/actors', () => ({
  checkOwnership: vi.fn(),
}));

vi.mock('@/services/actors/getOrCreateUserActor', () => ({
  getOrCreateUserActor: vi.fn().mockResolvedValue({ id: 'a1' }),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
  rateLimitWriteAsync: vi.fn(),
  createRateLimitResponse: vi.fn(() => ({ status: 429, json: async () => ({ success: false }) })),
  applyRateLimitHeaders: vi.fn((response: unknown) => response),
}));

import { createServerClient } from '@/lib/supabase/server';
import { checkOwnership } from '@/services/actors';
import { rateLimit, rateLimitWriteAsync } from '@/lib/rate-limit';

import type { Mock } from 'vitest';

type Case = {
  name: string;
  table: string;
  getHandler: (req: Request, params: { params: { id: string } }) => Promise<any>;
  putHandler: (req: Request, params: { params: { id: string } }) => Promise<any>;
  validUpdate: Record<string, unknown>;
};

const cases: Case[] = [
  {
    name: 'service',
    table: 'user_services',
    getHandler: getService as any,
    putHandler: putService as any,
    validUpdate: {
      title: 'Updated Service',
      category: 'consulting',
      fixed_price: 1234,
      service_location_type: 'remote',
    },
  },
  {
    name: 'product',
    table: 'user_products',
    getHandler: getProduct as any,
    putHandler: putProduct as any,
    validUpdate: {
      title: 'Updated Product',
      price: 1234,
      product_type: 'physical',
    },
  },
  {
    name: 'cause',
    table: 'user_causes',
    getHandler: getCause as any,
    putHandler: putCause as any,
    validUpdate: {
      title: 'Updated Cause',
      cause_category: 'Healthcare',
      lightning_address: '',
    },
  },
];

describe('Entity [id] CRUD workflows (service/product/cause)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (rateLimit as Mock).mockResolvedValue({ success: true });
    (rateLimitWriteAsync as Mock).mockResolvedValue({
      success: true,
      resetTime: Date.now() + 60000,
    });
    (checkOwnership as Mock).mockResolvedValue(true);
  });

  describe.each(cases)('$name id routes', ({ table, getHandler, putHandler, validUpdate }) => {
    it('GET returns active entity detail', async () => {
      const entity = {
        id: '00000000-0000-0000-0000-000000000001',
        user_id: 'u1',
        actor_id: 'a1',
        title: 'Entity',
        status: 'active',
      };

      const fetchQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: entity, error: null }),
      } as any;

      const supabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
        from: vi.fn().mockImplementation((name: string) => {
          expect(name).toBe(table);
          return fetchQuery;
        }),
      };

      (createServerClient as Mock).mockResolvedValue(supabase);

      const response = await getHandler({} as any, {
        params: { id: '00000000-0000-0000-0000-000000000001' },
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('00000000-0000-0000-0000-000000000001');
    });

    it('PUT updates own entity', async () => {
      const existing = {
        id: '00000000-0000-0000-0000-000000000001',
        user_id: 'u1',
        actor_id: 'a1',
        title: 'Old Title',
      };
      const updated = { ...existing, title: String(validUpdate.title) };

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

      const request = { json: vi.fn().mockResolvedValue(validUpdate) };
      const response = await putHandler(request as any, {
        params: { id: '00000000-0000-0000-0000-000000000001' },
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.title).toBe(String(validUpdate.title));
    });

    it('PUT rejects update from non-owner', async () => {
      (checkOwnership as Mock).mockResolvedValueOnce(false);
      const existing = {
        id: '00000000-0000-0000-0000-000000000001',
        user_id: 'someone-else',
        actor_id: 'other-actor',
        title: 'Locked',
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

      const request = { json: vi.fn().mockResolvedValue(validUpdate) };
      const response = await putHandler(request as any, {
        params: { id: '00000000-0000-0000-0000-000000000001' },
      });
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.success).toBe(false);
    });
  });
});

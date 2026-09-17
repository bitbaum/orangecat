import { GET as getAsset, PUT as putAsset } from '@/app/api/assets/[id]/route';
import { GET as getLoan, PUT as putLoan } from '@/app/api/loans/[id]/route';
import { GET as getEvent, PUT as putEvent } from '@/app/api/events/[id]/route';
import { GET as getWishlist, PUT as putWishlist } from '@/app/api/wishlists/[id]/route';
import { GET as getInvestment, PUT as putInvestment } from '@/app/api/investments/[id]/route';

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/services/actors', () => ({
  checkOwnership: vi.fn(),
}));

vi.mock('@/services/actors/getOrCreateUserActor', () => ({
  getOrCreateUserActor: vi.fn().mockResolvedValue({ id: 'a1' }),
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
  ownerField: 'user_id' | 'owner_id' | 'actor_id';
  getHandler: (req: Request, params: { params: { id: string } }) => Promise<any>;
  putHandler: (req: Request, params: { params: { id: string } }) => Promise<any>;
  validUpdate: Record<string, unknown>;
  usesActorOwnership?: boolean;
};

const cases: Case[] = [
  {
    name: 'asset',
    table: 'assets',
    ownerField: 'actor_id',
    getHandler: getAsset as any,
    putHandler: putAsset as any,
    validUpdate: { title: 'Updated Asset', type: 'real_estate', estimated_value: 1000 },
    usesActorOwnership: true,
  },
  {
    name: 'loan',
    table: 'loans',
    ownerField: 'actor_id',
    getHandler: getLoan as any,
    putHandler: putLoan as any,
    validUpdate: {
      title: 'Updated Loan',
      description: 'Updated loan description text',
      loan_type: 'new_request',
      original_amount: 1000,
      remaining_balance: 900,
      lightning_address: '',
    },
    usesActorOwnership: true,
  },
  {
    name: 'event',
    table: 'events',
    ownerField: 'actor_id',
    getHandler: getEvent as any,
    putHandler: putEvent as any,
    validUpdate: {
      title: 'Updated Event',
      start_date: new Date(Date.now() + 86400000).toISOString(),
      is_online: true,
      online_url: 'https://example.com/meet',
      ticket_price: 100,
    },
    usesActorOwnership: true,
  },
  {
    name: 'wishlist',
    table: 'wishlists',
    ownerField: 'actor_id',
    getHandler: getWishlist as any,
    putHandler: putWishlist as any,
    validUpdate: {
      title: 'Updated Wishlist',
      type: 'general',
      visibility: 'public',
    },
    usesActorOwnership: true,
  },
  {
    name: 'investment',
    table: 'investments',
    ownerField: 'actor_id',
    getHandler: getInvestment as any,
    putHandler: putInvestment as any,
    validUpdate: {
      title: 'Updated Investment',
      description: 'Revenue-share investment for community solar farm expansion.',
      investment_type: 'revenue_share',
      target_amount: 0.5,
      minimum_investment: 0.001,
    },
    usesActorOwnership: true,
  },
];

describe('Entity [id] CRUD workflows (asset/loan/event/wishlist/investment)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (rateLimit as Mock).mockResolvedValue({ success: true });
    (rateLimitWriteAsync as Mock).mockResolvedValue({
      success: true,
      resetTime: Date.now() + 60000,
    });
    (checkOwnership as Mock).mockResolvedValue(true);
  });

  describe.each(cases)('$name id routes', c => {
    it('GET returns entity detail', async () => {
      const entity: Record<string, unknown> = {
        id: '00000000-0000-0000-0000-000000000001',
        title: 'Entity',
        status: 'draft',
      };
      entity[c.ownerField] = c.ownerField === 'actor_id' ? 'a1' : 'u1';

      const fetchQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: entity, error: null }),
      } as any;

      const supabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
        },
        from: vi.fn().mockImplementation((name: string) => {
          expect(name).toBe(c.table);
          return fetchQuery;
        }),
      };

      (createServerClient as Mock).mockResolvedValue(supabase);

      const response = await c.getHandler({} as any, {
        params: { id: '00000000-0000-0000-0000-000000000001' },
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('00000000-0000-0000-0000-000000000001');
    });

    it('PUT updates own entity', async () => {
      const existing: Record<string, unknown> = {
        id: '00000000-0000-0000-0000-000000000001',
        title: 'Old',
      };
      existing[c.ownerField] = c.ownerField === 'actor_id' ? 'a1' : 'u1';
      const updated = { ...existing, title: String(c.validUpdate.title) };

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

      const response = await c.putHandler(
        { json: vi.fn().mockResolvedValue(c.validUpdate) } as any,
        { params: { id: '00000000-0000-0000-0000-000000000001' } }
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.title).toBe(String(c.validUpdate.title));
    });

    it('PUT rejects non-owner update', async () => {
      const existing: Record<string, unknown> = {
        id: '00000000-0000-0000-0000-000000000001',
        title: 'Locked',
      };
      existing[c.ownerField] = c.ownerField === 'actor_id' ? 'a1' : 'someone-else';

      if (c.usesActorOwnership) {
        (checkOwnership as Mock).mockResolvedValue(false);
      }

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

      const response = await c.putHandler(
        { json: vi.fn().mockResolvedValue(c.validUpdate) } as any,
        { params: { id: '00000000-0000-0000-0000-000000000001' } }
      );
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.success).toBe(false);
    });
  });
});

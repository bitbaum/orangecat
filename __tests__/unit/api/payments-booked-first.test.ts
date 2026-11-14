/**
 * Booked first, on the server too.
 *
 * The service page lost its "Buy" (a service is booked, and paid once the
 * provider accepts), but POST /api/payments still sold a service outright to
 * anyone who called it: paying without a booking, one request away.
 */
vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/api/withAuth', () => ({
  withAuth: (handler: (req: unknown) => unknown) => handler,
}));
vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: vi.fn((data: unknown, opts?: { status?: number }) => ({
    status: opts?.status ?? 200,
    json: async () => ({ success: true, data }),
  })),
  apiBadRequest: vi.fn((message = 'Bad request') => ({
    status: 400,
    json: async () => ({ success: false, error: { message } }),
  })),
  apiRateLimited: vi.fn(() => ({ status: 429, json: async () => ({}) })),
  apiInternalError: vi.fn(() => ({ status: 500, json: async () => ({}) })),
}));
vi.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: vi.fn().mockResolvedValue({ success: true }),
  retryAfterSeconds: vi.fn().mockReturnValue(30),
}));
vi.mock('@/domain/payments', () => ({ initiatePayment: vi.fn() }));

import { POST } from '@/app/api/payments/route';
import { initiatePayment } from '@/domain/payments';
import { BOOK_FIRST_MESSAGE } from '@/config/payment-flow';
import type { Mock } from 'vitest';

const ENTITY_ID = '11111111-2222-3333-4444-555555555555';
const post = (entityType: string) =>
  (POST as unknown as (req: unknown) => Promise<{ status: number; json(): Promise<any> }>)({
    user: { id: 'buyer-1' },
    supabase: {},
    json: async () => ({ entity_type: entityType, entity_id: ENTITY_ID }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  (initiatePayment as Mock).mockResolvedValue({ payment_intent: { id: 'pi-1' } });
});

describe('POST /api/payments', () => {
  it('refuses a service and points to the booking', async () => {
    const res = await post('service');
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toBe(BOOK_FIRST_MESSAGE);
    expect(initiatePayment).not.toHaveBeenCalled();
  });

  it('still sells a product', async () => {
    const res = await post('product');
    expect(res.status).toBe(201);
    expect(initiatePayment).toHaveBeenCalled();
  });
});

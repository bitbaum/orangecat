/**
 * POST /api/v1/payments/public — an amount outside an investment's stated terms
 * is answered with one 400 that names the bound, not the generic "could not
 * create the Bitcoin payment request" 500.
 */

import { POST } from '@/app/api/v1/payments/public/route';
import { initiatePublicSupport } from '@/domain/payments';
import { ContributionOutsideTermsError } from '@/domain/payments/knownPaymentErrors';

import type { Mock } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: vi.fn((data: unknown) => ({ status: 201, json: async () => ({ data }) })),
  apiBadRequest: vi.fn((message: string) => ({ status: 400, json: async () => ({ message }) })),
  apiInternalError: vi.fn((message: string) => ({ status: 500, json: async () => ({ message }) })),
  apiRateLimited: vi.fn(() => ({ status: 429, json: async () => ({}) })),
}));
vi.mock('@/domain/payments', () => ({ initiatePublicSupport: vi.fn() }));
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: vi.fn(() => ({})) }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: vi.fn().mockResolvedValue({ success: true }),
  rateLimitPaymentRecipient: vi.fn().mockResolvedValue({ success: true }),
  retryAfterSeconds: vi.fn().mockReturnValue(30),
}));

const request = () =>
  new Request('https://orangecat.ch/api/v1/payments/public', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      entity_type: 'investment',
      entity_id: '3eea8a36-3ca1-4cd6-88c9-cb31150a830b',
      amount_btc: 0.0001,
    }),
  });

describe('public support below an investment minimum', () => {
  it('answers 400 with the stated minimum', async () => {
    (initiatePublicSupport as Mock).mockRejectedValue(
      new ContributionOutsideTermsError('The minimum investment is ₿0.001.')
    );
    const res = (await POST(request())) as unknown as { status: number; json: () => unknown };
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: 'The minimum investment is ₿0.001.' });
  });
});

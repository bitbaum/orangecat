/**
 * POST /api/receive/request — the owner-side "get paid" mint.
 *
 * Guards under test:
 *  - amount bounds enforced (same sane caps as tips);
 *  - a wallet_id is resolved ONLY within the authenticated user's own active
 *    wallets (someone else's wallet id → clean 400, no intent minted);
 *  - no usable wallet → clean 400, not a 500;
 *  - happy path returns the invoice shape from the shared tips engine.
 */

import { POST } from '@/app/api/receive/request/route';
import {
  resolveUserWallet,
  resolveSpecificUserWallet,
} from '@/domain/payments/walletResolutionService';
import { initiateTip } from '@/domain/payments/paymentFlowService';
import { RECEIVE_MAX_BTC } from '@/config/receive';

import type { Mock } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/api/withAuth', () => ({
  withAuth:
    (handler: (req: unknown) => Promise<unknown>) =>
    (req: unknown): Promise<unknown> =>
      handler(Object.assign(req as object, { user: { id: 'owner-1' }, supabase: {} })),
}));
vi.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: vi.fn().mockResolvedValue({ success: true }),
  retryAfterSeconds: () => 0,
}));
vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: vi.fn((data: unknown) => ({ status: 200, data })),
  apiBadRequest: vi.fn((error: string) => ({ status: 400, error })),
  apiRateLimited: vi.fn(() => ({ status: 429 })),
  apiInternalError: vi.fn(() => ({ status: 500 })),
}));
vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { username: 'lena', display_name: 'Lena' }, error: null }),
    })),
  })),
}));
vi.mock('@/domain/payments/walletResolutionService', () => ({
  resolveUserWallet: vi.fn(),
  resolveSpecificUserWallet: vi.fn(),
}));
vi.mock('@/domain/payments/paymentFlowService', () => ({
  initiateTip: vi.fn(),
}));

const resolvePrimaryMock = resolveUserWallet as Mock;
const resolveSpecificMock = resolveSpecificUserWallet as Mock;
const initiateTipMock = initiateTip as Mock;

const WALLET = { method: 'lightning_address', wallet_id: 'w1', lightning_address: 'a@b.c' };
const TIP_RESULT = {
  payment_intent: { id: 'pi-1', payment_method: 'lightning_address' },
  status_token: 'tok',
  qr_data: 'LNBC...',
  method_label: 'Lightning Address',
  expires_in_seconds: 3600,
};

function makeRequest(body: unknown) {
  return { json: () => Promise.resolve(body) } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  initiateTipMock.mockResolvedValue(TIP_RESULT);
});

describe('POST /api/receive/request', () => {
  it('mints a request against the primary wallet by default', async () => {
    resolvePrimaryMock.mockResolvedValue(WALLET);
    const res = (await POST(makeRequest({ amount_btc: 0.0001 }))) as {
      status: number;
      data: Record<string, unknown>;
    };
    expect(res.status).toBe(200);
    expect(res.data.intentId).toBe('pi-1');
    expect(resolveSpecificMock).not.toHaveBeenCalled();
    expect(initiateTipMock).toHaveBeenCalledWith(
      expect.objectContaining({ recipientUserId: 'owner-1', amountBtc: 0.0001, wallet: WALLET })
    );
  });

  it('resolves an explicit wallet_id only within the owner scope', async () => {
    resolveSpecificMock.mockResolvedValue(WALLET);
    const res = (await POST(
      makeRequest({ amount_btc: 0.0001, wallet_id: '550e8400-e29b-41d4-a716-446655440000' })
    )) as { status: number };
    expect(res.status).toBe(200);
    expect(resolveSpecificMock).toHaveBeenCalledWith(
      expect.anything(),
      'owner-1',
      '550e8400-e29b-41d4-a716-446655440000'
    );
    expect(resolvePrimaryMock).not.toHaveBeenCalled();
  });

  it("refuses a wallet_id that isn't the owner's (resolver returns null) — no intent minted", async () => {
    resolveSpecificMock.mockResolvedValue(null);
    const res = (await POST(
      makeRequest({ amount_btc: 0.0001, wallet_id: '550e8400-e29b-41d4-a716-446655440000' })
    )) as { status: number };
    expect(res.status).toBe(400);
    expect(initiateTipMock).not.toHaveBeenCalled();
  });

  it('refuses when no wallet can receive — clean 400, not a 500', async () => {
    resolvePrimaryMock.mockResolvedValue(null);
    const res = (await POST(makeRequest({ amount_btc: 0.0001 }))) as { status: number };
    expect(res.status).toBe(400);
    expect(initiateTipMock).not.toHaveBeenCalled();
  });

  it('enforces amount bounds', async () => {
    resolvePrimaryMock.mockResolvedValue(WALLET);
    const over = (await POST(makeRequest({ amount_btc: RECEIVE_MAX_BTC + 1 }))) as {
      status: number;
    };
    expect(over.status).toBe(400);
    const zero = (await POST(makeRequest({ amount_btc: 0 }))) as { status: number };
    expect(zero.status).toBe(400);
    expect(initiateTipMock).not.toHaveBeenCalled();
  });
});

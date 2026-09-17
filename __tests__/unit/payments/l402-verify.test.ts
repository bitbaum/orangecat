/**
 * verifyL402Payment — the security contract of the 402 receipt.
 *
 * Three behaviors pinned here, each of which shipped broken in #556:
 *  1. A token is bound to ONE entity — replaying it against another URL is
 *     an opaque 404, even with a cryptographically valid preimage.
 *  2. A valid preimage SETTLES the intent (via settleVerifiedPayment) — the
 *     receipt and the ledger can't diverge.
 *  3. BUYER_CONFIRMED is the payer's own claim, not settlement — it must
 *     never produce an ok receipt.
 */

import { createHash, randomBytes } from 'crypto';
import { STATUS } from '@/config/database-constants';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const mockMaybeSingle = vi.fn();
const queryChain: Record<string, Mock> = {};
queryChain.select = vi.fn(() => queryChain);
queryChain.eq = vi.fn(() => queryChain);
queryChain.maybeSingle = mockMaybeSingle;
vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: () => ({ from: () => queryChain }),
}));

const mockCheckStatus = vi.fn();
const mockSettle = vi.fn();
vi.mock('@/domain/payments/paymentFlowService', () => ({
  initiatePublicSupport: vi.fn(),
  checkPublicPaymentStatus: (...args: unknown[]) => mockCheckStatus(...args),
  hashPublicStatusToken: (t: string) => `hashed:${t}`,
  settleVerifiedPayment: (...args: unknown[]) => mockSettle(...args),
}));

import { verifyL402Payment } from '@/domain/payments/l402';

import type { Mock } from 'vitest';

const ENTITY_ID = '11111111-2222-3333-4444-555555555555';
const OTHER_ENTITY_ID = '99999999-8888-7777-6666-555555555555';

const preimage = randomBytes(32).toString('hex');
const paymentHash = createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex');

const creds = { paymentIntentId: 'pi-1', statusToken: 'tok', preimage };
const expected = { entityType: 'product', entityId: ENTITY_ID };

function intentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pi-1',
    entity_type: 'product',
    entity_id: ENTITY_ID,
    payment_hash: paymentHash,
    status: 'invoice_ready',
    paid_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockMaybeSingle.mockReset();
  mockCheckStatus.mockReset();
  mockSettle.mockReset().mockResolvedValue(undefined);
});

describe('verifyL402Payment — receipt binding', () => {
  it('rejects a valid preimage replayed against a different entity (opaque 404)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: intentRow() });
    await expect(
      verifyL402Payment(creds, { entityType: 'product', entityId: OTHER_ENTITY_ID })
    ).rejects.toThrow('Payment not found');
    expect(mockSettle).not.toHaveBeenCalled();
    expect(mockCheckStatus).not.toHaveBeenCalled();
  });

  it('rejects a token replayed against a different entity TYPE', async () => {
    mockMaybeSingle.mockResolvedValue({ data: intentRow() });
    await expect(
      verifyL402Payment(creds, { entityType: 'service', entityId: ENTITY_ID })
    ).rejects.toThrow('Payment not found');
  });

  it('rejects an unknown token', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null });
    await expect(verifyL402Payment(creds, expected)).rejects.toThrow('Payment not found');
  });
});

describe('verifyL402Payment — preimage branch settles', () => {
  it('settles the intent and returns a paid receipt on a valid preimage', async () => {
    const row = intentRow();
    mockMaybeSingle.mockResolvedValue({ data: row });
    const result = await verifyL402Payment(creds, expected);
    expect(mockSettle).toHaveBeenCalledWith(row);
    expect(result.ok).toBe(true);
    expect(result.verified_by).toBe('preimage');
    expect(result.status).toBe(STATUS.PAYMENT_INTENTS.PAID);
    expect(result.paid_at).not.toBeNull();
    expect(mockCheckStatus).not.toHaveBeenCalled();
  });

  it('falls back to settlement status on a wrong preimage', async () => {
    mockMaybeSingle.mockResolvedValue({ data: intentRow() });
    mockCheckStatus.mockResolvedValue({ status: 'invoice_ready', paid_at: null });
    const result = await verifyL402Payment({ ...creds, preimage: 'f'.repeat(64) }, expected);
    expect(mockSettle).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.verified_by).toBeUndefined();
  });
});

describe('verifyL402Payment — settlement fallback trust boundary', () => {
  it('NEVER treats buyer_confirmed (self-attestation) as settlement', async () => {
    mockMaybeSingle.mockResolvedValue({ data: intentRow({ payment_hash: null }) });
    mockCheckStatus.mockResolvedValue({
      status: STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED,
      paid_at: null,
    });
    const result = await verifyL402Payment(creds, expected);
    expect(result.ok).toBe(false);
    expect(result.verified_by).toBeUndefined();
    expect(result.status).toBe(STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED);
  });

  it('accepts an observed PAID status for hashless rails', async () => {
    mockMaybeSingle.mockResolvedValue({ data: intentRow({ payment_hash: null }) });
    mockCheckStatus.mockResolvedValue({
      status: STATUS.PAYMENT_INTENTS.PAID,
      paid_at: '2026-08-02T12:00:00Z',
    });
    const result = await verifyL402Payment(creds, expected);
    expect(result.ok).toBe(true);
    expect(result.verified_by).toBe('settlement');
    expect(result.paid_at).toBe('2026-08-02T12:00:00Z');
  });
});

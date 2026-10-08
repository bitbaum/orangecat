/**
 * fund_project pays from the user's own wallet, then records the payment. Money
 * records are written by the server only, so the record goes through the
 * SERVER client. These pin where it is written, and that a failed record is
 * logged rather than lost — by then real money has moved.
 */

import { paymentHandlers } from '@/services/cat/handlers/payments';
import { resolveSenderNwcUri } from '@/domain/payments/sendPaymentService';
import { resolveSellerWallet, getSellerUserId } from '@/domain/payments/walletResolutionService';
import { generateInvoice } from '@/domain/payments/invoiceGenerationService';
import { getAdminClient } from '@/lib/supabase/admin';
import { NWCClient } from '@/lib/nostr/nwc';
import { logger } from '@/utils/logger';

import type { Mock } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/domain/payments/sendPaymentService', () => ({
  resolveSenderNwcUri: vi.fn(),
  sendToRecipient: vi.fn(),
}));
vi.mock('@/domain/payments/walletResolutionService', () => ({
  resolveSellerWallet: vi.fn(),
  getSellerUserId: vi.fn(),
}));
vi.mock('@/domain/payments/invoiceGenerationService', () => ({ generateInvoice: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));
vi.mock('@/lib/nostr/nwc', () => ({ NWCClient: vi.fn() }));

/** The user's session: must never write a money record. */
const userClient = {
  from: vi.fn(() => ({
    insert: vi.fn(() => {
      throw new Error("the user's session must not write money records");
    }),
  })),
};

function adminRecorder({ failIntent = false } = {}) {
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const client = {
    from: vi.fn((table: string) => {
      const b: Record<string, unknown> = {};
      b.select = vi.fn(() => b);
      b.eq = vi.fn(() => b);
      b.single = vi.fn(() => Promise.resolve({ data: { title: 'Clean water' }, error: null }));
      b.insert = vi.fn((row: Record<string, unknown>) => {
        inserts.push({ table, row });
        const fail = failIntent && table === 'payment_intents';
        b.single = vi.fn(() =>
          Promise.resolve(
            fail
              ? { data: null, error: { message: 'denied' } }
              : { data: { id: 'pi-1' }, error: null }
          )
        );
        return Object.assign(Promise.resolve({ error: null }), b);
      });
      return b;
    }),
  };
  return { client, inserts };
}

beforeEach(() => {
  vi.clearAllMocks();
  (resolveSenderNwcUri as Mock).mockResolvedValue('nostr+walletconnect://sender');
  (resolveSellerWallet as Mock).mockResolvedValue({
    method: 'lightning_address',
    wallet_id: 'project-wallet',
    lightning_address: 'project@getalby.com',
  });
  (getSellerUserId as Mock).mockResolvedValue('owner-1');
  (generateInvoice as Mock).mockResolvedValue({
    method: 'lightning_address',
    bolt11: 'lnbc1pfund',
  });
  // function (not arrow): vitest constructs mock implementations with `new`.
  (NWCClient as unknown as Mock).mockImplementation(function () {
    return {
      connect: vi.fn().mockResolvedValue(undefined),
      payInvoice: vi.fn().mockResolvedValue({ payment_hash: 'hash-fund' }),
      disconnect: vi.fn(),
    };
  });
});

const params = { project_id: 'project-1', amount_btc: 0.0005, message: 'go' };

describe('fund_project records the payment through the server', () => {
  it('writes the paid intent and the contribution with the server client', async () => {
    const admin = adminRecorder();
    (getAdminClient as Mock).mockReturnValue(admin.client);

    const result = await paymentHandlers.fund_project(userClient as never, 'user-1', null, params);

    expect(result.success).toBe(true);
    expect(admin.inserts.map(i => i.table)).toEqual(['payment_intents', 'contributions']);
    expect(admin.inserts[0].row).toMatchObject({
      buyer_id: 'user-1',
      seller_id: 'owner-1',
      intent_kind: 'support',
      receiving_wallet_id: 'project-wallet',
      status: 'paid',
    });
    expect(userClient.from).not.toHaveBeenCalled();
  });

  it('logs a record that failed to write — the money moved, the trace must not vanish', async () => {
    const admin = adminRecorder({ failIntent: true });
    (getAdminClient as Mock).mockReturnValue(admin.client);

    const result = await paymentHandlers.fund_project(userClient as never, 'user-1', null, params);

    expect(result.success).toBe(true);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('payment record was not written'),
      expect.objectContaining({ paymentHash: 'hash-fund' }),
      'CatPayments'
    );
  });
});

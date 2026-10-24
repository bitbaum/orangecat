/**
 * A payment can answer a request. Settlement marks the request paid only when
 * the payment covers the ask — "paid" has to mean the ask was met — and tells
 * the person who asked, by name, in their own currency. Anything short of the
 * ask leaves the request open, and an intent with no request does nothing.
 */

import { settlePaymentRequest } from '@/domain/payments/paymentRequestService';
import { NotificationDispatcher } from '@/services/notifications/dispatcher';
import type { PaymentIntent } from '@/domain/payments/types';

vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn(() => ({})) }));
vi.mock('@/domain/lightning-address/lnurl-service', () => ({ resolveLnurlRecipient: vi.fn() }));
vi.mock('@/services/notifications/dispatcher', () => ({
  NotificationDispatcher: { dispatch: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/services/currency/format-for-user.server', () => ({
  formatBtcForUser: vi.fn(async () => 'CHF 20.00'),
}));

// 1 CHF = 0.00001 BTC, unless a test says there is no rate.
const rateOf = vi.fn(async (amount: number): Promise<number | null> => amount * 0.00001);
vi.mock('@/services/currency/rates.server', () => ({
  convertToBtcOrNull: (amount: number) => rateOf(amount),
}));

interface Recorded {
  table: string;
  values: Record<string, unknown>;
}
const updates: Recorded[] = [];
let requestRow: Record<string, unknown> | null = null;
let moved: Array<{ id: string }> = [];

vi.mock('@/lib/supabase/untyped', () => ({
  fromTable: (_client: unknown, table: string) => {
    let values: Record<string, unknown> | null = null;
    const api = {
      select: () => api,
      update: (v: Record<string, unknown>) => {
        values = v;
        updates.push({ table, values: v });
        return api;
      },
      eq: () => api,
      maybeSingle: async () => ({
        data:
          table === 'payment_requests' ? requestRow : { username: 'marco', display_name: 'Marco' },
      }),
      // `await update(...).select('id')` resolves to the rows that moved.
      then: (resolve: (v: unknown) => void) => resolve({ data: values ? moved : [] }),
    };
    return api;
  },
}));

const intent = (over: Partial<PaymentIntent> = {}) =>
  ({
    id: 'pi1',
    seller_id: 'lena',
    amount_btc: 0.0002,
    payment_request_id: 'r1',
    ...over,
  }) as PaymentIntent;

const dispatch = NotificationDispatcher.dispatch as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  updates.length = 0;
  rateOf.mockImplementation(async (amount: number) => amount * 0.00001);
  requestRow = { id: 'r1', payer_id: 'marco', amount_btc: 0.0002, note: 'dinner' };
  moved = [{ id: 'r1' }];
});

describe('settlePaymentRequest', () => {
  it('marks the request paid and tells the asker who paid', async () => {
    expect(await settlePaymentRequest(intent())).toBe(true);

    const paid = updates.find(u => u.table === 'payment_requests');
    expect(paid?.values).toMatchObject({ status: 'paid', paid_intent_id: 'pi1' });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'lena',
        title: 'Marco paid you CHF 20.00',
        message: expect.stringContaining('for dinner'),
      })
    );
  });

  it('leaves the request open when the payment falls short of the ask', async () => {
    expect(await settlePaymentRequest(intent({ amount_btc: 0.0001 }))).toBe(false);
    expect(updates).toHaveLength(0);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('forgives rounding, not a smaller number', async () => {
    expect(await settlePaymentRequest(intent({ amount_btc: 0.00019985 }))).toBe(true);
  });

  it('does nothing for a payment that answers no request', async () => {
    expect(await settlePaymentRequest(intent({ payment_request_id: null }))).toBe(false);
    expect(updates).toHaveLength(0);
  });

  it('does nothing when the request is not open, or not addressed to the one paid', async () => {
    requestRow = null;
    expect(await settlePaymentRequest(intent())).toBe(false);
    expect(updates).toHaveLength(0);
  });

  it('says nothing twice when another observer settled it first', async () => {
    moved = [];
    expect(await settlePaymentRequest(intent())).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
  });

  describe('a request asked for in a currency', () => {
    // CHF 20 was 0.0002 BTC when asked; Bitcoin has since gone up, so CHF 20
    // is now only 0.00016 BTC (1 CHF = 0.000008 BTC).
    beforeEach(() => {
      requestRow = {
        id: 'r1',
        payer_id: 'marco',
        amount_btc: 0.0002,
        ask_amount: 20,
        ask_currency: 'CHF',
        note: 'dinner',
      };
      rateOf.mockImplementation(async (amount: number) => amount * 0.000008);
    });

    it('is met by what the currency buys today, not by the Bitcoin it was worth when asked', async () => {
      expect(await settlePaymentRequest(intent({ amount_btc: 0.00016 }))).toBe(true);
      expect(updates.find(u => u.table === 'payment_requests')?.values).toMatchObject({
        status: 'paid',
      });
    });

    it('forgives the rate moving a little between the invoice and the payment', async () => {
      expect(await settlePaymentRequest(intent({ amount_btc: 0.000158 }))).toBe(true);
    });

    it('still stays open when the payment is a smaller number', async () => {
      expect(await settlePaymentRequest(intent({ amount_btc: 0.00012 }))).toBe(false);
      expect(updates).toHaveLength(0);
    });

    it('falls back to the Bitcoin it was worth when asked if there is no rate', async () => {
      rateOf.mockResolvedValue(null);
      expect(await settlePaymentRequest(intent({ amount_btc: 0.00016 }))).toBe(false);
      expect(await settlePaymentRequest(intent({ amount_btc: 0.0002 }))).toBe(true);
    });
  });
});

/**
 * Paying a pay-page invoice from the payer's own wallet. The guards matter
 * more than the happy path: the amount is read from the intent, a wrong
 * token learns nothing, a finished or expired invoice is never paid, you
 * cannot pay yourself, and the payer is recorded only once the wallet is
 * known to be usable.
 */

import { payTipFromWallet } from '@/domain/tips/tip-wallet-pay';
import { hashPublicStatusToken } from '@/domain/payments/paymentFlowHelpers';
import { payOverNwc, resolveSenderNwcUri } from '@/domain/payments/sendPaymentService';
import type { Mock } from 'vitest';

vi.mock('@/domain/payments/sendPaymentService', () => ({
  payOverNwc: vi.fn(),
  resolveSenderNwcUri: vi.fn(),
}));

let intent: Record<string, unknown> | null = null;
const updates: Array<Record<string, unknown>> = [];
vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: () => ({
    from: () => {
      const api = {
        select: () => api,
        eq: () => api,
        is: () => api,
        update: (v: Record<string, unknown>) => {
          updates.push(v);
          return api;
        },
        maybeSingle: async () => ({ data: intent }),
        then: (resolve: (v: unknown) => void) => resolve({ data: null }),
      };
      return api;
    },
  }),
}));

const TOKEN = 'tok_abc';
const open = (over: Record<string, unknown> = {}) => ({
  id: 'i1',
  seller_id: 'lena',
  bolt11: 'lnbc1',
  amount_btc: 0.0002,
  status: 'invoice_ready',
  intent_kind: 'tip',
  public_status_token_hash: hashPublicStatusToken(TOKEN),
  expires_at: new Date(Date.now() + 600_000).toISOString(),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  updates.length = 0;
  intent = open();
  (resolveSenderNwcUri as Mock).mockResolvedValue('nostr+walletconnect://x');
  (payOverNwc as Mock).mockResolvedValue({
    ok: true,
    paymentHash: 'h',
    amountBtc: 0.0002,
    destination: 'lena',
  });
});

describe('payTipFromWallet', () => {
  it("pays the intent's own invoice and amount, and records the payer first", async () => {
    const result = await payTipFromWallet('marco', 'i1', TOKEN);

    expect(result.ok).toBe(true);
    expect(payOverNwc).toHaveBeenCalledWith(
      'marco',
      'nostr+walletconnect://x',
      'lnbc1',
      0.0002,
      'lena'
    );
    expect(updates).toContainEqual({ buyer_id: 'marco' });
  });

  it('learns nothing for a wrong token, a missing intent or another kind', async () => {
    const wrongToken = await payTipFromWallet('marco', 'i1', 'tok_wrong');
    intent = null;
    const missing = await payTipFromWallet('marco', 'i1', TOKEN);
    intent = open({ intent_kind: 'purchase' });
    const otherKind = await payTipFromWallet('marco', 'i1', TOKEN);

    for (const bad of [wrongToken, missing, otherKind]) {
      expect(bad).toMatchObject({ ok: false, message: 'That payment request was not found.' });
    }
    expect(payOverNwc).not.toHaveBeenCalled();
  });

  it('never pays a finished or expired invoice', async () => {
    intent = open({ status: 'paid' });
    expect(await payTipFromWallet('marco', 'i1', TOKEN)).toMatchObject({ ok: false });
    intent = open({ status: 'expired' });
    expect(await payTipFromWallet('marco', 'i1', TOKEN)).toMatchObject({ ok: false });
    intent = open({ expires_at: new Date(Date.now() - 1000).toISOString() });
    expect(await payTipFromWallet('marco', 'i1', TOKEN)).toMatchObject({ ok: false });
    expect(payOverNwc).not.toHaveBeenCalled();
  });

  it('refuses to pay yourself', async () => {
    expect(await payTipFromWallet('lena', 'i1', TOKEN)).toMatchObject({
      ok: false,
      reason: 'self_send',
    });
    expect(payOverNwc).not.toHaveBeenCalled();
  });

  it('says so for an on-chain-only request, and records nobody', async () => {
    intent = open({ bolt11: null });
    expect(await payTipFromWallet('marco', 'i1', TOKEN)).toMatchObject({ ok: false });
    expect(updates).toHaveLength(0);
  });

  it('passes a wallet problem through, without recording the payer', async () => {
    (resolveSenderNwcUri as Mock).mockResolvedValue({
      ok: false,
      reason: 'no_sender_wallet',
      message: 'Connect a Lightning wallet before sending.',
    });
    expect(await payTipFromWallet('marco', 'i1', TOKEN)).toMatchObject({
      reason: 'no_sender_wallet',
    });
    expect(updates).toHaveLength(0);
    expect(payOverNwc).not.toHaveBeenCalled();
  });
});

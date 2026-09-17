/**
 * A send-only NWC connection must not take receiving down with it.
 *
 * NWC outranks every other rail in wallet resolution. But an NWC connection can
 * be authorised for one direction only — Coinos issues send-only connections
 * (a budget and a max fee, i.e. `pay_invoice` without `make_invoice`). So
 * connecting one to switch ON payouts switched OFF receiving: every invoice on
 * catomean@orangecat.ch failed with "Could not create an invoice right now"
 * (production, 2026-09-07) until the connection was pulled back out.
 *
 * A rail that cannot mint an invoice is not a receiving rail.
 */

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const makeInvoice = vi.fn();
const connect = vi.fn();
const disconnect = vi.fn();

vi.mock('@/lib/nostr/nwc', () => ({
  NWCClient: class {
    connect = connect;
    disconnect = disconnect;
    makeInvoice = makeInvoice;
  },
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateInvoice } from '@/domain/payments/invoiceGenerationService';
import type { ResolvedWallet } from '@/domain/payments/types';

const LN_INVOICE = 'lnbc20n1pexamplefallbackinvoice';

/** A lightning-address provider that mints invoices happily. */
function stubLnurlProvider() {
  global.fetch = vi.fn(async (url: unknown) => {
    const href = String(url);
    if (href.includes('/.well-known/lnurlp/')) {
      return {
        ok: true,
        json: async () => ({
          tag: 'payRequest',
          callback: 'https://coinos.io/api/lnurl/cb',
          minSendable: 1000,
          maxSendable: 100000000000,
          metadata: '[["text/plain","pay"]]',
        }),
      };
    }
    return { ok: true, json: async () => ({ pr: LN_INVOICE, verify: 'https://coinos.io/v' }) };
  }) as unknown as typeof fetch;
}

describe('send-only NWC falls back to the lightning address', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubLnurlProvider();
  });

  it('receives via the lightning address when NWC cannot mint an invoice', async () => {
    // Exactly the production failure: the connection pays but will not mint.
    makeInvoice.mockRejectedValue(new Error('permission denied: make_invoice'));

    const wallet: ResolvedWallet = {
      method: 'nwc',
      wallet_id: 'w1',
      nwc_uri: 'nostr+walletconnect://deadbeef',
      lightning_address: 'orangecat@coinos.io',
    };

    const invoice = await generateInvoice(wallet, 0.0000002, 'test');

    // The regression: this threw "Failed to generate Lightning invoice via NWC"
    // and the whole payment failed.
    expect(invoice.bolt11).toBe(LN_INVOICE);
  });

  it('still prefers NWC when it works — the fallback is not a downgrade', async () => {
    makeInvoice.mockResolvedValue({ invoice: 'lnbc_from_nwc', payment_hash: 'abc' });

    const invoice = await generateInvoice(
      {
        method: 'nwc',
        wallet_id: 'w1',
        nwc_uri: 'nostr+walletconnect://deadbeef',
        lightning_address: 'orangecat@coinos.io',
      },
      0.0000002,
      'test'
    );

    expect(invoice.bolt11).toBe('lnbc_from_nwc');
  });

  it('still fails when NWC is the only rail — nothing to fall back to', async () => {
    makeInvoice.mockRejectedValue(new Error('permission denied: make_invoice'));

    await expect(
      generateInvoice(
        { method: 'nwc', wallet_id: 'w1', nwc_uri: 'nostr+walletconnect://deadbeef' },
        0.0000002,
        'test'
      )
    ).rejects.toThrow();
  });
});

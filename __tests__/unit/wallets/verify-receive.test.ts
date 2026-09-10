/**
 * "Looks good" must mean "can be paid", not "has the right shape".
 *
 * The wallet form congratulated anything shaped like an address.
 * `wallabypatient182172@getalby.com` is perfectly shaped and answers every
 * payment request with "The recipient's wallet is not properly configured" —
 * so a user connected a wallet, was told it looked good, and stayed unpayable
 * until someone tried to pay them. This asks for a real invoice instead.
 */

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyReceiveCapability } from '@/domain/wallets/verifyReceive';

const OK_META = {
  tag: 'payRequest',
  callback: 'https://provider.example/cb',
  minSendable: 1000,
  maxSendable: 100000000,
};

function respond(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

/** Route the two-step LNURL flow: metadata, then the invoice callback. */
function stubProvider(meta: unknown, invoice: unknown, opts: { metaOk?: boolean } = {}) {
  global.fetch = vi.fn(async (url: unknown) => {
    if (String(url).includes('/.well-known/lnurlp/')) {
      return respond(meta, opts.metaOk ?? true, opts.metaOk === false ? 404 : 200);
    }
    return respond(invoice);
  }) as unknown as typeof fetch;
}

describe('connect-time receive verification', () => {
  beforeEach(() => vi.clearAllMocks());

  it('confirms an address that mints a real invoice', async () => {
    stubProvider(OK_META, { pr: 'lnbc10n1p4...', verify: 'https://provider.example/v/1' });

    const v = await verifyReceiveCapability('lightning_address', 'someone@provider.example');

    expect(v.status).toBe('receivable');
    expect(v).toMatchObject({ autoConfirms: true });
  });

  it('catches the address that resolves but cannot be paid', async () => {
    // The exact Alby failure: step one succeeds, step two refuses. Checking
    // only the metadata would have called this healthy.
    stubProvider(OK_META, {
      status: 'ERROR',
      reason: "The recipient's wallet is not properly configured.",
    });

    const v = await verifyReceiveCapability(
      'lightning_address',
      'wallabypatient182172@getalby.com'
    );

    expect(v.status).toBe('unusable');
    // The provider's own words reach the user, not a generic message.
    expect(v.detail).toContain('not properly configured');
  });

  it('says settlement is manual when the provider offers no verify URL', async () => {
    stubProvider(OK_META, { pr: 'lnbc10n1p4...' });

    const v = await verifyReceiveCapability('lightning_address', 'someone@provider.example');

    expect(v).toMatchObject({ status: 'receivable', autoConfirms: false });
    expect(v.detail).toMatch(/confirm/i);
  });

  it('reports an unknown address as unusable, not as a network problem', async () => {
    stubProvider({ status: 'ERROR' }, null, { metaOk: false });

    const v = await verifyReceiveCapability('lightning_address', 'nobody@provider.example');

    expect(v.status).toBe('unusable');
  });

  it('an unreachable provider is UNKNOWN, never "unusable"', async () => {
    // The distinction that matters: a provider outage must not accuse a
    // correct address of being broken, and must not block saving it.
    global.fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;

    const v = await verifyReceiveCapability('lightning_address', 'someone@provider.example');

    expect(v.status).toBe('unknown');
    expect(v.detail).toMatch(/saved anyway/i);
  });

  it('does not pretend to verify an on-chain address', async () => {
    // An unused address is indistinguishable from a wrong one. Claiming to
    // have checked it would be theatre.
    const v = await verifyReceiveCapability('onchain', 'bc1qexample');
    expect(v.status).toBe('unknown');
  });
});

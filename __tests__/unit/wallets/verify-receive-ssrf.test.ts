/**
 * The verifier fetches a domain the USER typed, then follows a callback URL the
 * REMOTE SERVER chose. Both are server-side request forgery unless guarded.
 *
 * `someone@169.254.169.254` would make the server read cloud metadata;
 * `someone@127.0.0.1` reaches anything on loopback. And because this feature
 * deliberately surfaces the provider's own words to the user, the response
 * would be carried straight back out. A dependency audit cannot see any of
 * this — it is our own code.
 */

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyReceiveCapability } from '@/domain/wallets/verifyReceive';

/** Records every URL the code tries to open. */
let attempted: string[] = [];

function trackFetch(impl?: (url: string) => unknown) {
  global.fetch = vi.fn(async (input: unknown) => {
    const url = String(input);
    attempted.push(url);
    if (impl) {
      return impl(url) as never;
    }
    return { ok: true, status: 200, json: async () => ({ tag: 'payRequest' }) } as never;
  }) as unknown as typeof fetch;
}

describe('verification refuses to be an SSRF gadget', () => {
  beforeEach(() => {
    attempted = [];
    vi.clearAllMocks();
  });

  it.each([
    ['cloud metadata', 'someone@169.254.169.254'],
    ['loopback', 'someone@127.0.0.1'],
    ['private range', 'someone@10.0.0.5'],
    ['localhost', 'someone@localhost'],
    ['bare intranet name', 'someone@vault'],
    ['mdns', 'someone@printer.local'],
    ['internal suffix', 'someone@db.internal'],
  ])('never opens a connection for %s', async (_label, address) => {
    trackFetch();

    const v = await verifyReceiveCapability('lightning_address', address);

    // The point is not the verdict text — it is that NOTHING was fetched.
    expect(attempted).toEqual([]);
    expect(v.status).toBe('unusable');
  });

  it('does not follow a provider that points the callback at an internal host', async () => {
    // A public, permitted domain hands back a hostile callback. The guard has
    // to apply to the SECOND request too, not just the user's input.
    trackFetch(url => {
      if (url.includes('/.well-known/lnurlp/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            tag: 'payRequest',
            callback: 'https://169.254.169.254/latest/meta-data',
          }),
        };
      }
      throw new Error('the internal host must never be reached');
    });

    const v = await verifyReceiveCapability('lightning_address', 'someone@provider.example');

    expect(v.status).toBe('unusable');
    expect(attempted.some(u => u.includes('169.254.169.254'))).toBe(false);
  });

  it('still allows an ordinary public provider', async () => {
    trackFetch(url =>
      url.includes('/.well-known/lnurlp/')
        ? {
            ok: true,
            status: 200,
            json: async () => ({ tag: 'payRequest', callback: 'https://provider.example/cb' }),
          }
        : { ok: true, status: 200, json: async () => ({ pr: 'lnbc10n1p4...' }) }
    );

    const v = await verifyReceiveCapability('lightning_address', 'someone@provider.example');

    expect(v.status).toBe('receivable');
  });
});

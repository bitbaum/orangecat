/**
 * clientIpKey — the limiter is only as honest as its notion of "who".
 *
 * Caddy APPENDS to X-Forwarded-For, so a request that reached us through it
 * carries `<whatever the caller sent>, <what Caddy actually saw>`. Reading the
 * first entry — which three payment routes did, while rate-limit.ts read the
 * header whole — keys every limiter on a value the caller chooses.
 *
 * The consequence is not a weakened limiter. Vary the header per request and
 * each request lands in a fresh bucket, so no bucket ever fills: no limiter at
 * all, on routes that mint a real Lightning invoice through the recipient's
 * wallet. bitbaum/orangecat#563 finding 2.
 */

import { clientIpKey } from '@/lib/client-ip';

const req = (headers: Record<string, string>) =>
  ({ headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } }) as unknown as Request;

describe('clientIpKey', () => {
  it('returns the hop Caddy wrote, not the one the caller sent', () => {
    expect(clientIpKey(req({ 'x-forwarded-for': '9.9.9.9, 203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('gives one key for one client however the prefix is spoofed', () => {
    // The bypass itself: three requests from the same client, three forged
    // prefixes. Before the fix these produced three keys and no bucket filled.
    const keys = new Set(
      ['1.1.1.1', '2.2.2.2', 'not-even-an-ip'].map((spoof) =>
        clientIpKey(req({ 'x-forwarded-for': `${spoof}, 203.0.113.7` })),
      ),
    );
    expect([...keys]).toEqual(['203.0.113.7']);
  });

  it('handles the ordinary single-hop request', () => {
    expect(clientIpKey(req({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('tolerates the whitespace Caddy leaves after the comma', () => {
    expect(clientIpKey(req({ 'x-forwarded-for': '9.9.9.9,   203.0.113.7  ' }))).toBe('203.0.113.7');
  });

  it('falls back to x-real-ip, then to one shared bucket', () => {
    expect(clientIpKey(req({ 'x-real-ip': '8.8.8.8' }))).toBe('8.8.8.8');
    expect(clientIpKey(req({}))).toBe('anonymous');
  });

  it('never returns an empty key from a malformed header', () => {
    // An empty key would collapse every caller into one bucket silently, or
    // worse, produce the key "l402:" and look like a real identity.
    expect(clientIpKey(req({ 'x-forwarded-for': '' }))).toBe('anonymous');
    expect(clientIpKey(req({ 'x-forwarded-for': ' , , ' }))).toBe('anonymous');
    expect(clientIpKey(req({ 'x-forwarded-for': ',' , 'x-real-ip': '8.8.8.8' }))).toBe('8.8.8.8');
  });
});

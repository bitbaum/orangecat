import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  signWebhookPayload,
  verifyWebhookSignature as verifyInApp,
} from '@/services/webhooks/signing';
import { verifyWebhookSignature as verifyInSdk } from '../../../packages/sdk/src/webhooks';

/**
 * Webhook signature verification exists TWICE: once in the app, which signs
 * and verifies its own deliveries, and once in @orangecat/sdk, which is what a
 * customer imports to check a delivery we sent them.
 *
 * The SDK is a published, standalone package — it cannot import from src/ —
 * and the app cannot import the SDK's dist without making a customer-facing
 * package a build dependency of the site. So the copy stays for now, and this
 * is what stops it drifting: both implementations are driven through the same
 * vectors and must agree on every one. If someone tightens the app's
 * verification and not the SDK's, this test goes red instead of a customer
 * quietly accepting a delivery we would have rejected.
 *
 * Every case below is a real way a signature check gets weakened: accepting a
 * replayed delivery, accepting a forged one, or accepting a header that
 * carries no signature at all.
 */

const SECRET = 'whsec_test_5f4dcc3b5aa765d61d8327deb882cf99';
const BODY = '{"event":"payment.settled","data":{"amount_btc":"0.00042000"}}';
const NOW = new Date('2026-09-15T12:00:00.000Z');

function sign(body: string, secret: string, at: Date): string {
  return signWebhookPayload(body, secret, at);
}

function bothAgree(
  body: string,
  header: string | null | undefined,
  secret = SECRET,
  now: Date = NOW
): { valid: boolean; reason?: string } {
  const app = verifyInApp(body, secret, header, { now });
  const sdk = verifyInSdk(body, secret, header, { now });
  expect(sdk).toEqual(app);
  return app as { valid: boolean; reason?: string };
}

describe('webhook signature verification — the app and the SDK must agree', () => {
  it('accepts a signature this app just produced', () => {
    expect(bothAgree(BODY, sign(BODY, SECRET, NOW))).toEqual({ valid: true });
  });

  it('rejects a body that changed by one byte', () => {
    const header = sign(BODY, SECRET, NOW);
    expect(bothAgree(BODY.replace('0.00042000', '0.00420000'), header)).toEqual({
      valid: false,
      reason: 'signature_mismatch',
    });
  });

  it('rejects a signature made with a different secret', () => {
    const header = sign(BODY, 'whsec_someone_elses_secret', NOW);
    expect(bothAgree(BODY, header)).toEqual({ valid: false, reason: 'signature_mismatch' });
  });

  it('rejects a replay from outside the tolerance window', () => {
    const header = sign(BODY, SECRET, new Date(NOW.getTime() - 6 * 60 * 1000));
    expect(bothAgree(BODY, header)).toEqual({
      valid: false,
      reason: 'timestamp_outside_tolerance',
    });
  });

  it('accepts a delivery inside the tolerance window, in both directions', () => {
    expect(bothAgree(BODY, sign(BODY, SECRET, new Date(NOW.getTime() - 4 * 60 * 1000)))).toEqual({
      valid: true,
    });
    // Clock skew the other way is equally within tolerance.
    expect(bothAgree(BODY, sign(BODY, SECRET, new Date(NOW.getTime() + 4 * 60 * 1000)))).toEqual({
      valid: true,
    });
  });

  it('rejects a timestamp that was bumped without re-signing', () => {
    // A captured delivery, signed a minute ago, with its `t` moved forward to
    // get back inside the tolerance window. The timestamp is part of the
    // signed material, so moving it invalidates the signature — this is the
    // whole reason it is signed.
    const stale = sign(BODY, SECRET, new Date(NOW.getTime() - 6 * 60 * 1000));
    const bumped = stale.replace(/^t=\d+/, `t=${Math.floor(NOW.getTime() / 1000)}`);
    expect(bothAgree(BODY, bumped)).toEqual({ valid: false, reason: 'signature_mismatch' });
    // Unbumped, the same capture is refused for being too old.
    expect(bothAgree(BODY, stale)).toEqual({
      valid: false,
      reason: 'timestamp_outside_tolerance',
    });
  });

  it('rejects headers that carry no usable signature', () => {
    expect(bothAgree(BODY, null)).toEqual({ valid: false, reason: 'malformed_header' });
    expect(bothAgree(BODY, '')).toEqual({ valid: false, reason: 'malformed_header' });
    expect(bothAgree(BODY, 'garbage')).toEqual({ valid: false, reason: 'malformed_header' });
    // A timestamp and nothing to check it against is not a signature.
    expect(bothAgree(BODY, `t=${Math.floor(NOW.getTime() / 1000)}`)).toEqual({
      valid: false,
      reason: 'unknown_scheme',
    });
    // An unknown scheme version must not be treated as v1.
    expect(
      bothAgree(BODY, `t=${Math.floor(NOW.getTime() / 1000)},v2=${'a'.repeat(64)}`)
    ).toEqual({ valid: false, reason: 'unknown_scheme' });
  });

  it('rejects a non-hex signature of the right length rather than throwing', () => {
    const ts = Math.floor(NOW.getTime() / 1000);
    expect(bothAgree(BODY, `t=${ts},v1=${'z'.repeat(64)}`)).toEqual({
      valid: false,
      reason: 'signature_mismatch',
    });
  });

  it('accepts the right signature among several candidates (key rotation)', () => {
    const ts = Math.floor(NOW.getTime() / 1000);
    const good = createHmac('sha256', SECRET).update(`${ts}.${BODY}`).digest('hex');
    expect(bothAgree(BODY, `t=${ts},v1=${'0'.repeat(64)},v1=${good}`)).toEqual({ valid: true });
  });

  it('compares in constant time — a wrong signature is rejected by length, never by prefix', () => {
    const ts = Math.floor(NOW.getTime() / 1000);
    const good = createHmac('sha256', SECRET).update(`${ts}.${BODY}`).digest('hex');
    // Same length, differs only in the last nibble: the comparison must still
    // reject it, and must not have short-circuited on the shared prefix.
    const lastByteOff = good.slice(0, -1) + (good.endsWith('0') ? '1' : '0');
    expect(bothAgree(BODY, `t=${ts},v1=${lastByteOff}`)).toEqual({
      valid: false,
      reason: 'signature_mismatch',
    });
    // A truncated signature must fail on length, not be accepted as a prefix.
    expect(bothAgree(BODY, `t=${ts},v1=${good.slice(0, 32)}`)).toEqual({
      valid: false,
      reason: 'signature_mismatch',
    });
  });
});

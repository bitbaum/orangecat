/**
 * Webhook signing — HMAC-SHA-256, Stripe-style header.
 *
 * Header format:  t=<unix_seconds>,v1=<hex_signature>
 * Signed string:  `${timestamp}.${rawRequestBody}`
 * Algorithm:      HMAC-SHA-256 with the endpoint's plaintext secret.
 *
 * Why the timestamp is part of the signed payload:
 *   An attacker who captures a delivery cannot replay it forever —
 *   the receiver enforces a tolerance window (default 5 minutes).
 *   The timestamp is signed so the attacker can't just bump it.
 *
 * Why timing-safe equality:
 *   Plain string `===` leaks bytewise differences via timing side
 *   channels. `crypto.timingSafeEqual` runs in constant time.
 *
 * Compatibility:
 *   The signing side is server-only — we never sign on the client.
 *
 * TWO COPIES, ONE BEHAVIOUR:
 *   packages/sdk/src/webhooks.ts carries the same verification, because the
 *   SDK ships to customers and cannot import from src/. The copy is held in
 *   step by __tests__/unit/services/webhook-signature-parity.test.ts, which
 *   drives BOTH through the same vectors and fails if they ever disagree.
 *   Change one, change the other, and let that test say you did.
 *
 * Created: 2026-06-03
 */

import { createHmac, timingSafeEqual } from 'crypto';

const SCHEME = 'v1' as const;
const DEFAULT_TOLERANCE_SECONDS = 300;

export interface VerifySignatureOpts {
  /** Max age of the signed timestamp in seconds. Default 300 (5 minutes). */
  toleranceSeconds?: number;
  /** Override "now" for tests. */
  now?: Date;
}

export type VerifyReason =
  | 'malformed_header'
  | 'unknown_scheme'
  | 'timestamp_outside_tolerance'
  | 'signature_mismatch';

export type VerifyResult = { valid: true } | { valid: false; reason: VerifyReason };

function computeSignature(timestamp: number, rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

/**
 * Sign a delivery payload. Returns the value to put in the
 * `X-OrangeCat-Signature` header.
 */
export function signWebhookPayload(
  rawBody: string,
  secret: string,
  now: Date = new Date()
): string {
  const timestamp = Math.floor(now.getTime() / 1000);
  const signature = computeSignature(timestamp, rawBody, secret);
  return `t=${timestamp},${SCHEME}=${signature}`;
}

/**
 * Verify a delivery the integration just received. The raw HTTP body
 * string MUST be passed exactly as received — parsing then re-serialising
 * the JSON will change byte-for-byte content and the signature will
 * fail, which is correct behaviour.
 *
 * Returns a discriminated union so callers can distinguish the four
 * failure reasons for logging / debugging — never branch user-facing
 * behaviour on the reason (don't leak the failure mode to attackers).
 */
export function verifyWebhookSignature(
  rawBody: string,
  secret: string,
  signatureHeader: string | null | undefined,
  opts: VerifySignatureOpts = {}
): VerifyResult {
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    return { valid: false, reason: 'malformed_header' };
  }

  const parsed = parseHeader(signatureHeader);
  if (!parsed) {
    return { valid: false, reason: 'malformed_header' };
  }
  if (!parsed.signatures.length) {
    return { valid: false, reason: 'unknown_scheme' };
  }

  const tolerance = opts.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const now = opts.now ?? new Date();
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (Math.abs(nowSeconds - parsed.timestamp) > tolerance) {
    return { valid: false, reason: 'timestamp_outside_tolerance' };
  }

  const expected = computeSignature(parsed.timestamp, rawBody, secret);

  // Try each provided v1= signature so receivers can support multi-secret
  // key rotation later without touching this code.
  for (const candidate of parsed.signatures) {
    if (safeHexEqual(candidate, expected)) {
      return { valid: true };
    }
  }

  return { valid: false, reason: 'signature_mismatch' };
}

interface ParsedHeader {
  timestamp: number;
  signatures: string[];
}

function parseHeader(header: string): ParsedHeader | null {
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const segment of header.split(',')) {
    const eqIdx = segment.indexOf('=');
    if (eqIdx < 1) {
      continue;
    }
    const key = segment.slice(0, eqIdx).trim();
    const value = segment.slice(eqIdx + 1).trim();
    if (!key || !value) {
      continue;
    }

    if (key === 't') {
      const parsedTs = Number.parseInt(value, 10);
      if (!Number.isFinite(parsedTs) || parsedTs <= 0) {
        return null;
      }
      timestamp = parsedTs;
    } else if (key === SCHEME) {
      signatures.push(value);
    }
  }

  if (timestamp === null) {
    return null;
  }
  return { timestamp, signatures };
}

/** Constant-time hex comparison. Returns false if lengths differ. */
function safeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  try {
    const ab = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ab.length !== bb.length) {
      return false;
    }
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

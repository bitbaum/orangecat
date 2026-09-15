/**
 * Verify a signed webhook delivery from OrangeCat.
 *
 * Header format (X-OrangeCat-Signature):
 *   t=<unix_seconds>,v1=<hex_signature>
 *
 * Algorithm: HMAC-SHA-256 over `${timestamp}.${rawRequestBody}` keyed by
 * the endpoint's signing secret. The timestamp is inside the signed
 * material so a captured delivery can't be replayed past the tolerance
 * window.
 *
 * Usage (Node 18+):
 *
 *   import { verifyWebhookSignature } from '@orangecat/sdk';
 *
 *   app.post('/webhooks/orangecat', (req, res) => {
 *     // IMPORTANT: pass the raw HTTP body string, not the parsed JSON.
 *     // Parsing + re-serialising changes byte-for-byte content and the
 *     // signature will (correctly) fail.
 *     const result = verifyWebhookSignature(
 *       req.rawBody,
 *       process.env.WEBHOOK_SECRET,
 *       req.headers['x-orangecat-signature']
 *     );
 *     if (!result.valid) return res.status(401).end();
 *     // ... handle delivery
 *   });
 *
 * Never branch user-facing behaviour on `result.reason` — it's for
 * logging and debugging only.
 *
 * TWO COPIES, ONE BEHAVIOUR:
 *   src/services/webhooks/signing.ts carries the same verification for the
 *   app itself. This package must stay standalone (customers install it), so
 *   the copy is held in step by the app's
 *   __tests__/unit/services/webhook-signature-parity.test.ts, which drives
 *   BOTH through the same vectors and fails if they ever disagree.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const SCHEME = 'v1' as const;
const DEFAULT_TOLERANCE_SECONDS = 300;

export interface VerifyWebhookSignatureOpts {
  /** Max age of the signed timestamp in seconds. Default 300 (5 minutes). */
  toleranceSeconds?: number;
  /** Override "now" for tests. */
  now?: Date;
}

export type WebhookVerifyReason =
  | 'malformed_header'
  | 'unknown_scheme'
  | 'timestamp_outside_tolerance'
  | 'signature_mismatch';

export type WebhookVerifyResult = { valid: true } | { valid: false; reason: WebhookVerifyReason };

export function verifyWebhookSignature(
  rawBody: string,
  secret: string,
  signatureHeader: string | string[] | null | undefined,
  opts: VerifyWebhookSignatureOpts = {}
): WebhookVerifyResult {
  // Node 18 http headers may surface as string[] when repeated — collapse.
  const header = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  if (!header || typeof header !== 'string') {
    return { valid: false, reason: 'malformed_header' };
  }

  const parsed = parseHeader(header);
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

  const expected = createHmac('sha256', secret)
    .update(`${parsed.timestamp}.${rawBody}`)
    .digest('hex');

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

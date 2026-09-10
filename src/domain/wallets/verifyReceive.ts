/**
 * Can this thing actually be paid?
 *
 * The wallet form said "Lightning address — looks good" based on SHAPE alone.
 * `wallabypatient182172@getalby.com` has a perfect shape and answers every
 * payment request with
 *   {"status":"ERROR","reason":"The recipient's wallet is not properly
 *    configured. Please reach out to the recipient to resolve this issue."}
 * So the user connected a wallet, was congratulated, and remained unpayable —
 * finding out only when someone tried to pay them, if ever. A dead NWC sat in
 * production for months the same way.
 *
 * Shape is not capability. This asks the provider for a real invoice and
 * reports what came back.
 *
 * Server-side only: resolving a lightning address means calling a third party,
 * and doing that from the browser hands over the visitor's IP.
 */

import { logger } from '@/utils/logger';
import { BITCOIN_FETCH_TIMEOUT_MS } from '@/lib/wallets/constants';

/** A probe amount small enough to be under every provider's minimum ceiling. */
const PROBE_MSATS = 1000;

export type ReceiveVerdict =
  /** Provider minted an invoice. This address can be paid right now. */
  | { status: 'receivable'; autoConfirms: boolean; detail: string }
  /** We reached the provider and it refused. The user must fix something. */
  | { status: 'unusable'; detail: string }
  /** We could not reach it. NOT the same as broken — say so honestly. */
  | { status: 'unknown'; detail: string };

/**
 * Refuse anything that is not a public HTTPS endpoint.
 *
 * This module takes a DOMAIN FROM USER INPUT and fetches it, then follows a
 * callback URL chosen by that remote server. Without this guard both are a
 * server-side request forgery: `someone@169.254.169.254` makes the server read
 * cloud metadata, `someone@127.0.0.1` reaches anything bound to loopback, and
 * the provider's own words — which this feature deliberately surfaces to the
 * user — would carry the response back out.
 *
 * IP literals are rejected outright rather than range-checked: a real Lightning
 * provider always has a DNS name, so there is no legitimate case to preserve
 * and no parsing edge case (octal, decimal, IPv6-mapped) left to get wrong.
 */
function assertPublicHttpsUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('BAD_TARGET');
  }
  if (url.protocol !== 'https:') {
    throw new Error('BAD_TARGET');
  }
  const host = url.hostname.toLowerCase();
  const isIpLiteral = host.startsWith('[') || /^[0-9.]+$/.test(host);
  const isLocal =
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    !host.includes('.');
  if (isIpLiteral || isLocal) {
    throw new Error('BAD_TARGET');
  }
  return url;
}

async function getJson(url: string): Promise<{ ok: boolean; status: number; body: unknown }> {
  const target = assertPublicHttpsUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BITCOIN_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(target, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      // A permitted host must not be able to bounce us somewhere private.
      redirect: 'error',
    });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask a lightning address for a real invoice.
 *
 * Two steps, and BOTH can fail independently: `/.well-known/lnurlp/<user>` can
 * resolve fine while the callback refuses — which is exactly the Alby failure.
 * Checking only the first step would have called that address healthy.
 */
async function verifyLightningAddress(address: string): Promise<ReceiveVerdict> {
  const [user, domain] = address.split('@');
  if (!user || !domain) {
    return { status: 'unusable', detail: 'That is not a valid Lightning address.' };
  }

  let meta: { ok: boolean; status: number; body: unknown };
  try {
    meta = await getJson(`https://${domain}/.well-known/lnurlp/${user}`);
  } catch (error) {
    if (error instanceof Error && error.message === 'BAD_TARGET') {
      return {
        status: 'unusable',
        detail: 'A Lightning address must point at a public domain name.',
      };
    }
    return {
      status: 'unknown',
      detail: `Could not reach ${domain}. Saved anyway — try verifying again in a moment.`,
    };
  }

  const metaBody = meta.body as { tag?: string; callback?: string; status?: string } | null;
  if (!meta.ok || metaBody?.tag !== 'payRequest') {
    return {
      status: 'unusable',
      detail: `${domain} does not recognise "${user}" as a Lightning address.`,
    };
  }
  if (!metaBody.callback) {
    return { status: 'unusable', detail: `${domain} returned no payment endpoint.` };
  }

  let invoice: { ok: boolean; status: number; body: unknown };
  try {
    const sep = metaBody.callback.includes('?') ? '&' : '?';
    // The callback is chosen by the REMOTE server, so it is guarded too — a
    // hostile provider must not be able to aim us at an internal address.
    invoice = await getJson(`${metaBody.callback}${sep}amount=${PROBE_MSATS}`);
  } catch (error) {
    if (error instanceof Error && error.message === 'BAD_TARGET') {
      return {
        status: 'unusable',
        detail: `${domain} pointed the payment somewhere we will not follow.`,
      };
    }
    return {
      status: 'unknown',
      detail: `Could not reach ${domain}. Saved anyway — try verifying again in a moment.`,
    };
  }

  const body = invoice.body as { pr?: string; verify?: string; reason?: string } | null;
  if (!body?.pr) {
    // The provider's own words are more useful than anything we could invent.
    return {
      status: 'unusable',
      detail: body?.reason?.trim() || `${domain} would not create an invoice for this address.`,
    };
  }

  // LUD-21: a verify URL means settlement can be confirmed automatically
  // instead of asking the payer "did you pay?".
  const autoConfirms = typeof body.verify === 'string' && body.verify.startsWith('https://');
  return {
    status: 'receivable',
    autoConfirms,
    detail: autoConfirms
      ? 'Payments will arrive here and confirm automatically.'
      : 'Payments will arrive here. This provider cannot confirm settlement automatically, so buyers will be asked to confirm.',
  };
}

/**
 * Verify whatever the user pasted.
 *
 * On-chain addresses and extended keys are deliberately NOT probed: an address
 * with no history is indistinguishable from a wrong one, so any "verification"
 * would be theatre. Their correctness is structural, and the caller has already
 * validated it.
 */
export async function verifyReceiveCapability(
  kind: 'lightning_address' | 'onchain' | 'nwc',
  value: string
): Promise<ReceiveVerdict> {
  if (kind === 'lightning_address') {
    const verdict = await verifyLightningAddress(value.trim().toLowerCase());
    logger.info('Verified lightning address', { status: verdict.status });
    return verdict;
  }

  if (kind === 'onchain') {
    return {
      status: 'unknown',
      detail:
        'A Bitcoin address cannot be tested without spending — an unused address looks identical to a wrong one. Double-check you pasted it from your wallet.',
    };
  }

  // NWC is a spending credential; probing it would mean connecting with it here.
  // The payment path already reports a connection it cannot use, and a
  // send-only connection is legitimate — receiving falls back to the Lightning
  // address (see invoiceGenerationService).
  return {
    status: 'unknown',
    detail:
      'Wallet connections are checked when a payment is made. Add a Lightning address too so receiving works even if the connection is send-only.',
  };
}

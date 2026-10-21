/**
 * What the Send field was given, read the way the server will read it.
 *
 * One field takes a username, a Lightning address, an invoice, or a scanned
 * code — a pay link from someone's Receive screen, or a `lightning:` QR from a
 * wallet. The person never says which; the text does. Keeping the switch out of
 * the UI removed a second row of tabs under the first, and keeping the rules
 * here keeps the preview honest: what we SAY it is, is what gets paid.
 */

import { normalizeBolt11, parseBolt11 } from '@/lib/bitcoin/bolt11';
import { parsePayPrefill } from '@/config/pay';

export type SendDestination =
  | { kind: 'empty' }
  /** A BOLT11 invoice, normalised to lowercase; the amount is inside it. */
  | { kind: 'invoice'; invoice: string }
  /** name@host — paid directly; nobody on OrangeCat to vouch for it. */
  | { kind: 'address'; address: string }
  /** An OrangeCat account, possibly with what a scanned pay link asked for. */
  | { kind: 'username'; username: string; amountBtc?: number; note?: string };

const LIGHTNING_SCHEME = /^lightning:(\/\/)?/i;
const PAY_PATH = /^\/pay\/([^/]+)\/?$/;

export function classifyDestination(raw: string): SendDestination {
  let text = (raw ?? '').trim();
  if (!text) {
    return { kind: 'empty' };
  }
  text = text.replace(LIGHTNING_SCHEME, '');

  if (parseBolt11(text)) {
    return { kind: 'invoice', invoice: normalizeBolt11(text) };
  }

  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      const match = url.pathname.match(PAY_PATH);
      if (match) {
        const prefill = parsePayPrefill(url.searchParams);
        return {
          kind: 'username',
          username: decodeURIComponent(match[1]),
          ...(prefill.amountBtc ? { amountBtc: prefill.amountBtc } : {}),
          ...(prefill.note ? { note: prefill.note } : {}),
        };
      }
    } catch {
      // Not a URL we can read; fall through and let the server refuse it.
    }
  }

  const handle = text.replace(/^@/, '');
  if (handle.includes('@')) {
    return { kind: 'address', address: handle };
  }
  return { kind: 'username', username: handle };
}

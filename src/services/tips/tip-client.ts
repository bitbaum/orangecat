/**
 * Browser client for the tipping endpoints. Type-only imports of the service
 * shapes (erased at compile — no server code pulled into the bundle).
 */

import { API_ROUTES } from '@/config/api-routes';
import { unwrapApiResponse } from '@/lib/api/client-response';
import type { TipInvoice, TipReceiveInfo, TipStatusResult } from '@/domain/tips/tip-service';

export type { TipInvoice, TipReceiveInfo, TipStatusResult } from '@/domain/tips/tip-service';

export async function fetchTipReceiveInfo(username: string): Promise<TipReceiveInfo> {
  const res = await fetch(`${API_ROUTES.TIPS.RECEIVE_INFO}?username=${encodeURIComponent(username)}`);
  return unwrapApiResponse<TipReceiveInfo>(res, 'Could not load tip info.');
}

export async function fetchTipInvoice(username: string, amountBtc: number): Promise<TipInvoice> {
  const res = await fetch(API_ROUTES.TIPS.INVOICE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, amountBtc }),
  });
  const { invoice } = await unwrapApiResponse<{ invoice: TipInvoice }>(res, 'Could not create a tip request.');
  return invoice;
}

/** Poll whether a tip has settled, using the intent id + bearer token. */
export async function fetchTipStatus(intentId: string, token: string): Promise<TipStatusResult> {
  const res = await fetch(API_ROUTES.TIPS.STATUS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intentId, token }),
  });
  return unwrapApiResponse<TipStatusResult>(res, 'Could not check tip status.');
}

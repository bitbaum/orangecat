/**
 * Browser client for person-to-person payment requests.
 */

import { API_ROUTES } from '@/config/api-routes';
import { unwrapApiResponse } from '@/lib/api/client-response';
import type { PaymentRequestRow } from '@/domain/payments/paymentRequestService';

export type { PaymentRequestRow };

export async function fetchPaymentRequests(): Promise<{
  incoming: PaymentRequestRow[];
  outgoing: PaymentRequestRow[];
}> {
  const res = await fetch(API_ROUTES.PAYMENT_REQUESTS.BASE);
  return unwrapApiResponse<{ incoming: PaymentRequestRow[]; outgoing: PaymentRequestRow[] }>(
    res,
    'Could not load your requests.'
  );
}

export async function createRequest(
  payerUsername: string,
  amountBtc: number,
  note?: string
): Promise<PaymentRequestRow> {
  const res = await fetch(API_ROUTES.PAYMENT_REQUESTS.BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payer_username: payerUsername,
      amount_btc: amountBtc,
      ...(note ? { note } : {}),
    }),
  });
  const { request } = await unwrapApiResponse<{ request: PaymentRequestRow }>(
    res,
    'Could not create that request.'
  );
  return request;
}

export async function closeRequest(id: string, status: 'cancelled' | 'declined'): Promise<void> {
  const res = await fetch(API_ROUTES.PAYMENT_REQUESTS.BY_ID(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  await unwrapApiResponse<unknown>(res, 'Could not update that request.');
}

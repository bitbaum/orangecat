/**
 * Browser client for the owner's ways to be paid (Twint, PayPal, a bank, …).
 */

import { API_ROUTES } from '@/config/api-routes';
import { unwrapApiResponse } from '@/lib/api/client-response';
import type { PaymentMethodRow } from '@/domain/payments/paymentMethodsService';
import type { PaymentMethodId } from '@/config/payment-methods';

export type { PaymentMethodRow };

export async function fetchPaymentMethods(): Promise<PaymentMethodRow[]> {
  const res = await fetch(API_ROUTES.PAYMENT_METHODS.BASE);
  const { methods } = await unwrapApiResponse<{ methods: PaymentMethodRow[] }>(
    res,
    'Could not load your ways to be paid.'
  );
  return methods;
}

export async function addPaymentMethod(input: {
  method: PaymentMethodId;
  handle: string;
  label?: string;
}): Promise<PaymentMethodRow> {
  const res = await fetch(API_ROUTES.PAYMENT_METHODS.BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const { method } = await unwrapApiResponse<{ method: PaymentMethodRow }>(
    res,
    'Could not save that way to be paid.'
  );
  return method;
}

export async function removePaymentMethod(id: string): Promise<void> {
  const res = await fetch(API_ROUTES.PAYMENT_METHODS.BY_ID(id), { method: 'DELETE' });
  await unwrapApiResponse<unknown>(res, 'Could not remove that way to be paid.');
}

/**
 * Browser client for /send. Thin on purpose — every decision that matters
 * (resolution, bounds, whether the payment happened) belongs on the server.
 */

import { API_ROUTES } from '@/config/api-routes';

export interface SendOutcome {
  paymentHash: string;
  amountBtc: number | null;
  destination: string;
}

/** A failed send with the server's reason, so the screen can tell a "no" from a "maybe". */
export class SendError extends Error {
  constructor(
    message: string,
    readonly reason?: string
  ) {
    super(message);
    this.name = 'SendError';
  }
}

async function post(body: unknown): Promise<SendOutcome> {
  const res = await fetch(API_ROUTES.SEND, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) ?? {};
  if (!res.ok || !json.success) {
    const err = json.error;
    const message =
      (typeof err === 'string' ? err : (err as { message?: string })?.message) ||
      'The payment did not go through.';
    const reason = (err as { details?: { reason?: unknown } } | undefined)?.details?.reason;
    throw new SendError(message, typeof reason === 'string' ? reason : undefined);
  }
  return json.data as SendOutcome;
}

export function sendToPerson(recipient: string, amountBtc: number, memo?: string) {
  return post({ recipient, amount_btc: amountBtc, ...(memo ? { memo } : {}) });
}

/**
 * Pay the invoice a pay page just minted, from the signed-in payer's own
 * wallet. The amount comes from the invoice on the server, not from here.
 */
export async function payIntentFromWallet(
  intentId: string,
  statusToken: string
): Promise<{ paymentHash: string }> {
  const res = await fetch(API_ROUTES.TIPS.PAY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intentId, statusToken }),
  });
  const json = (await res.json().catch(() => null)) ?? {};
  if (!res.ok || !json.success) {
    const err = json.error;
    const message =
      (typeof err === 'string' ? err : (err as { message?: string })?.message) ||
      'The payment did not go through.';
    const reason = (err as { details?: { reason?: unknown } } | undefined)?.details?.reason;
    throw new SendError(message, typeof reason === 'string' ? reason : undefined);
  }
  return json.data as { paymentHash: string };
}

export function sendInvoice(invoice: string) {
  return post({ invoice });
}

export interface SendCapability {
  canSend: boolean;
  /** Present when `canSend` is false — already payer-readable, shown as-is. */
  message?: string;
  /** Why, so the screen can tell "you need a wallet" from "we're broken". */
  reason?: string;
}

/**
 * Whether this user can send, asked before the form is offered rather than
 * discovered on the final tap. Treated as capable if the check itself fails:
 * a network hiccup must not lock someone out of paying.
 */
export async function fetchSendCapability(): Promise<SendCapability> {
  try {
    const res = await fetch(API_ROUTES.SEND, { method: 'GET' });
    // Signed out is a definite no, not "probably fine".
    if (res.status === 401) {
      return { canSend: false, reason: 'signed_out' };
    }
    const json = await res.json();
    return json?.success ? (json.data as SendCapability) : { canSend: true };
  } catch {
    return { canSend: true };
  }
}

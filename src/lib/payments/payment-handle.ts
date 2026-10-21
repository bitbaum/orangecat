/**
 * What a person types for a payment handle, turned into what we store.
 *
 * People paste the whole thing: `https://paypal.me/lena`, `@lena`, `$lena`,
 * an IBAN with its spaces. The sheet says "PayPal.me name", and rejecting the
 * pasted link would be the form quizzing them on which part it meant. So the
 * packaging comes off here and the rule stays simple: one method, one handle.
 */

import {
  PAYMENT_HANDLE_MAX_LENGTH,
  PAYMENT_METHODS,
  type PaymentMethodId,
} from '@/config/payment-methods';

/** ISO 13616: two letters, two check digits, up to 30 alphanumerics. */
const IBAN_SHAPE = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;
/** E.164-ish: an optional +, then 8 to 15 digits. Spaces and dots are people's. */
const PHONE_SHAPE = /^\+?\d{8,15}$/;
/** A service username: what the services themselves accept. */
const USERNAME_SHAPE = /^[A-Za-z0-9._-]{1,64}$/;

/** The mod-97 check every real IBAN passes; a typo fails it. */
export function isValidIban(iban: string): boolean {
  if (!IBAN_SHAPE.test(iban)) {
    return false;
  }
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = /\d/.test(char) ? char : String(char.charCodeAt(0) - 55);
    for (const digit of digits) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

/**
 * Strip the packaging and say whether what is left is a handle of this kind.
 * Returns the clean handle, or null when nothing usable is left.
 */
export function normalizePaymentHandle(method: PaymentMethodId, raw: string): string | null {
  let handle = (raw ?? '').trim();
  if (!handle) {
    return null;
  }

  for (const prefix of PAYMENT_METHODS[method].stripPrefixes) {
    if (handle.toLowerCase().startsWith(prefix)) {
      handle = handle.slice(prefix.length);
    }
  }
  handle = handle.replace(/\/+$/, '').trim();

  switch (method) {
    case 'bank': {
      const iban = handle.replace(/\s+/g, '').toUpperCase();
      return isValidIban(iban) ? iban : null;
    }
    case 'twint': {
      const digits = handle.replace(/[\s.\-()]/g, '');
      return PHONE_SHAPE.test(digits) ? digits : null;
    }
    case 'other':
      return handle.length <= PAYMENT_HANDLE_MAX_LENGTH && !/[\s]/.test(handle) ? handle : null;
    default:
      return USERNAME_SHAPE.test(handle) ? handle : null;
  }
}

/** The handle as a person reads it: an IBAN in groups of four, the rest as is. */
export function formatPaymentHandle(method: PaymentMethodId, handle: string): string {
  if (method === 'bank') {
    return handle.replace(/(.{4})/g, '$1 ').trim();
  }
  if (method === 'cashapp') {
    return `$${handle}`;
  }
  if (method === 'venmo') {
    return `@${handle}`;
  }
  return handle;
}

/**
 * What a person types for a payment handle, turned into what we store.
 *
 * People paste the whole thing: `https://paypal.me/lena`, `@lena`, `$lena`,
 * an IBAN with its spaces, `upi://pay?pa=lena@upi`. The sheet names the part
 * it wants, and rejecting the pasted whole would be the form quizzing them on
 * which part it meant. So the packaging comes off here, and the check is by
 * HANDLE KIND (phone, username, IBAN, …), not by service — a new rail in the
 * registry gets its validation for free.
 */

import {
  PAYMENT_HANDLE_MAX_LENGTH,
  PAYMENT_METHODS,
  type HandleKind,
  type PaymentMethodId,
} from '@/config/payment-methods';

/** ISO 13616: two letters, two check digits, up to 30 alphanumerics. */
const IBAN_SHAPE = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;
/** E.164-ish: an optional +, then 8 to 15 digits. Spaces and dots are people's. */
const PHONE_SHAPE = /^\+?\d{8,15}$/;
/** A service username: what the services themselves accept. */
const USERNAME_SHAPE = /^[A-Za-z0-9._-]{1,64}$/;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** UPI: name@bank. */
const VPA_SHAPE = /^[A-Za-z0-9._-]{2,}@[A-Za-z]{2,}$/;
/** A service's own id — no spaces, no quotes. */
const ID_SHAPE = /^[A-Za-z0-9._@+-]{2,64}$/;
/** Zcash: a unified (u1…), transparent (t1…/t3…) or Sapling (zs1…) address. */
const ZCASH_SHAPE = /^(u1[0-9a-z]{20,}|t[13][0-9A-Za-z]{33}|zs1[0-9a-z]{75})$/;
/** Pix: a CPF (11 digits), a CNPJ (14 digits) or a random key (UUID). */
const PIX_TAX_ID = /^\d{11}$|^\d{14}$/;
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

const phoneDigits = (raw: string) => raw.replace(/[\s.\-()]/g, '');

/** Clean and check one handle by its kind. Null when nothing usable is left. */
export function normalizeHandleOfKind(kind: HandleKind, handle: string): string | null {
  switch (kind) {
    case 'iban': {
      const iban = handle.replace(/\s+/g, '').toUpperCase();
      return isValidIban(iban) ? iban : null;
    }
    case 'phone': {
      const digits = phoneDigits(handle);
      return PHONE_SHAPE.test(digits) ? digits : null;
    }
    case 'email':
      return EMAIL_SHAPE.test(handle) ? handle.toLowerCase() : null;
    case 'contact': {
      if (EMAIL_SHAPE.test(handle)) {
        return handle.toLowerCase();
      }
      const digits = phoneDigits(handle);
      return PHONE_SHAPE.test(digits) ? digits : null;
    }
    case 'vpa':
      return VPA_SHAPE.test(handle) ? handle.toLowerCase() : null;
    case 'key': {
      if (EMAIL_SHAPE.test(handle) || UUID_SHAPE.test(handle)) {
        return handle.toLowerCase();
      }
      const digits = phoneDigits(handle);
      return PHONE_SHAPE.test(digits) || PIX_TAX_ID.test(digits) ? digits : null;
    }
    case 'id':
      return ID_SHAPE.test(handle)
        ? handle
        : PHONE_SHAPE.test(phoneDigits(handle))
          ? phoneDigits(handle)
          : null;
    case 'address':
      return ZCASH_SHAPE.test(handle) ? handle : null;
    case 'link':
      return handle.length <= PAYMENT_HANDLE_MAX_LENGTH && !/\s/.test(handle) ? handle : null;
    case 'username':
      return USERNAME_SHAPE.test(handle) ? handle : null;
  }
}

/**
 * Strip the packaging and say whether what is left is a handle of this
 * method's kind. Returns the clean handle, or null when nothing usable is left.
 */
export function normalizePaymentHandle(method: PaymentMethodId, raw: string): string | null {
  let handle = (raw ?? '').trim();
  if (!handle) {
    return null;
  }
  const kind = PAYMENT_METHODS[method];
  for (const prefix of kind.stripPrefixes) {
    if (handle.toLowerCase().startsWith(prefix)) {
      handle = handle.slice(prefix.length);
    }
  }
  handle = handle.replace(/\/+$/, '').trim();
  if (!handle || handle.length > PAYMENT_HANDLE_MAX_LENGTH) {
    return null;
  }
  return normalizeHandleOfKind(kind.handleKind, handle);
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
  if (method === 'zcash') {
    return `${handle.slice(0, 8)}…${handle.slice(-6)}`;
  }
  return handle;
}

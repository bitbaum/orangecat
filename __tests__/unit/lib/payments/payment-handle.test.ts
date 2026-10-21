/**
 * A pasted handle arrives with its packaging — the link, the @, the $, the
 * spaces in an IBAN. The sheet asks for the name; the normaliser takes the link.
 */

import {
  formatPaymentHandle,
  isValidIban,
  normalizePaymentHandle,
} from '@/lib/payments/payment-handle';

describe('normalizePaymentHandle', () => {
  it('takes a PayPal.me link, an @ or a bare name', () => {
    expect(normalizePaymentHandle('paypal', 'https://paypal.me/lena')).toBe('lena');
    expect(normalizePaymentHandle('paypal', 'PayPal.me/lena/')).toBe('lena');
    expect(normalizePaymentHandle('paypal', '@lena')).toBe('lena');
    expect(normalizePaymentHandle('paypal', 'lena')).toBe('lena');
  });

  it('takes a $cashtag with or without the $', () => {
    expect(normalizePaymentHandle('cashapp', '$lena')).toBe('lena');
    expect(normalizePaymentHandle('cashapp', 'https://cash.app/$lena')).toBe('lena');
  });

  it('keeps only the digits of a phone number', () => {
    expect(normalizePaymentHandle('twint', '+41 79 123 45 67')).toBe('+41791234567');
    expect(normalizePaymentHandle('twint', '079-123.45.67')).toBe('0791234567');
    expect(normalizePaymentHandle('twint', 'lena')).toBeNull();
  });

  it('checks an IBAN rather than trusting its shape', () => {
    expect(normalizePaymentHandle('bank', 'ch93 0076 2011 6238 5295 7')).toBe(
      'CH9300762011623852957'
    );
    expect(normalizePaymentHandle('bank', 'CH93 0076 2011 6238 5295 8')).toBeNull();
    expect(isValidIban('DE89370400440532013000')).toBe(true);
    expect(isValidIban('DE89370400440532013001')).toBe(false);
  });

  it('refuses a username the service would refuse', () => {
    expect(normalizePaymentHandle('revolut', 'lena smith')).toBeNull();
    expect(normalizePaymentHandle('venmo', '')).toBeNull();
  });
});

describe('formatPaymentHandle', () => {
  it('reads the way the service shows it', () => {
    expect(formatPaymentHandle('bank', 'CH9300762011623852957')).toBe('CH93 0076 2011 6238 5295 7');
    expect(formatPaymentHandle('cashapp', 'lena')).toBe('$lena');
    expect(formatPaymentHandle('venmo', 'lena')).toBe('@lena');
    expect(formatPaymentHandle('twint', '+41791234567')).toBe('+41791234567');
  });
});

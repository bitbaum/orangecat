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

  it('reads the handles the rest of the world uses', () => {
    expect(normalizePaymentHandle('upi', 'upi://pay?pa=Lena@UPI')).toBe('lena@upi');
    expect(normalizePaymentHandle('upi', 'lena')).toBeNull();
    expect(normalizePaymentHandle('pix', 'lena@example.com')).toBe('lena@example.com');
    expect(normalizePaymentHandle('pix', '123.456.789-09')).toBe('12345678909');
    expect(normalizePaymentHandle('pix', 'b6f1c3e2-9a7d-4c2b-8f1e-2a3b4c5d6e7f')).toBe(
      'b6f1c3e2-9a7d-4c2b-8f1e-2a3b4c5d6e7f'
    );
    expect(normalizePaymentHandle('zelle', '+1 (415) 555-0100')).toBe('+14155550100');
    expect(normalizePaymentHandle('zelle', 'Lena@Example.com')).toBe('lena@example.com');
    expect(normalizePaymentHandle('mpesa', '0712 345 678')).toBe('0712345678');
    expect(normalizePaymentHandle('wechat', 'lena_wx')).toBe('lena_wx');
    expect(normalizePaymentHandle('wechat', 'lena wx')).toBeNull();
    const zec = 't1' + 'A'.repeat(33);
    expect(normalizePaymentHandle('zcash', `zcash:${zec}`)).toBe(zec);
    expect(normalizePaymentHandle('zcash', 'u1' + 'q'.repeat(60))).toBe('u1' + 'q'.repeat(60));
    expect(normalizePaymentHandle('zcash', 't1ABC')).toBeNull();
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
    expect(formatPaymentHandle('zcash', 't1' + 'A'.repeat(33))).toBe('t1AAAAAA…AAAAAA');
  });
});

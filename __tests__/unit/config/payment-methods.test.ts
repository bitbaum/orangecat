/**
 * Every way to be paid is one registry entry, and a tap on it opens exactly
 * what that service accepts — with the amount only in a currency it takes.
 */

import {
  PAYMENT_METHOD_IDS,
  PAYMENT_METHODS,
  isPaymentMethodId,
  paymentMethodUrl,
} from '@/config/payment-methods';

describe('PAYMENT_METHODS', () => {
  it('names every method and what the owner has to type', () => {
    for (const id of PAYMENT_METHOD_IDS) {
      const kind = PAYMENT_METHODS[id];
      expect(kind.id).toBe(id);
      expect(kind.name.length).toBeGreaterThan(0);
      expect(kind.handleLabel.length).toBeGreaterThan(0);
      expect(kind.handlePlaceholder.length).toBeGreaterThan(0);
    }
    expect(isPaymentMethodId('twint')).toBe(true);
    expect(isPaymentMethodId('bitcoin')).toBe(false);
  });
});

describe('paymentMethodUrl', () => {
  it('fills the amount in only where the service takes that currency', () => {
    expect(paymentMethodUrl('paypal', 'lena', { value: 20, currency: 'CHF' })).toBe(
      'https://paypal.me/lena/20.00CHF'
    );
    expect(paymentMethodUrl('cashapp', 'lena', { value: 20, currency: 'USD' })).toBe(
      'https://cash.app/$lena/20.00'
    );
    // Cash App does not move francs: the link opens without a number rather
    // than with a wrong one.
    expect(paymentMethodUrl('cashapp', 'lena', { value: 20, currency: 'CHF' })).toBe(
      'https://cash.app/$lena'
    );
    expect(paymentMethodUrl('venmo', 'lena', { value: 7.5, currency: 'USD' })).toBe(
      'https://venmo.com/lena?txn=pay&amount=7.50'
    );
  });

  it('has no link for a handle that is copied into an app', () => {
    expect(paymentMethodUrl('twint', '+41791234567')).toBe('');
    expect(paymentMethodUrl('bank', 'CH9300762011623852957')).toBe('');
    expect(paymentMethodUrl('other', 'lena')).toBe('');
    expect(paymentMethodUrl('other', 'https://pay.example/lena')).toBe('https://pay.example/lena');
  });
});

/**
 * Every way to be paid is one registry entry on three axes — identity,
 * custody, reach — and a tap on it opens exactly what that service accepts,
 * with the amount only in a currency it takes.
 */

import {
  BITCOIN_RAIL,
  PAYMENT_METHOD_IDS,
  PAYMENT_METHODS,
  PAYMENT_REGION_ORDER,
  isPaymentMethodId,
  payerLearns,
  paymentMethodUrl,
  paymentMethodsIn,
} from '@/config/payment-methods';

describe('PAYMENT_METHODS', () => {
  it('names every rail, what the owner types, and its three axes', () => {
    for (const id of PAYMENT_METHOD_IDS) {
      const kind = PAYMENT_METHODS[id];
      expect(kind.id).toBe(id);
      expect(kind.name.length).toBeGreaterThan(0);
      expect(kind.handleLabel.length).toBeGreaterThan(0);
      expect(kind.handlePlaceholder.length).toBeGreaterThan(0);
      expect(kind.reveals.length).toBeGreaterThan(0);
      expect(['self', 'provider']).toContain(kind.custody);
      expect(PAYMENT_REGION_ORDER).toContain(kind.region);
    }
    expect(isPaymentMethodId('twint')).toBe(true);
    expect(isPaymentMethodId('bitcoin')).toBe(false);
  });

  it('reaches beyond Switzerland and the US', () => {
    const regions = new Set(PAYMENT_METHOD_IDS.map(id => PAYMENT_METHODS[id].region));
    expect([...regions].sort()).toEqual([...PAYMENT_REGION_ORDER].sort());
    expect(paymentMethodsIn('africa').map(k => k.id)).toContain('mpesa');
    expect(paymentMethodsIn('asia_pacific').map(k => k.id)).toEqual(
      expect.arrayContaining(['upi', 'alipay', 'wechat', 'paynow'])
    );
    expect(paymentMethodsIn('americas').map(k => k.id)).toContain('pix');
  });

  it('is honest about identity: only self-custody rails show a handle alone', () => {
    for (const id of PAYMENT_METHOD_IDS) {
      const kind = PAYMENT_METHODS[id];
      if (kind.reveals.includes('handle_only')) {
        expect(kind.custody).toBe('self');
      } else {
        expect(kind.reveals).toContain('name');
      }
    }
    expect(BITCOIN_RAIL.reveals).toEqual(['handle_only']);
  });
});

describe('payerLearns', () => {
  it('builds the sentence from the facts', () => {
    expect(payerLearns(['name'])).toBe('A payer learns your name.');
    expect(payerLearns(['name', 'phone'])).toBe('A payer learns your name and your phone number.');
    expect(payerLearns(['name', 'bank_account'])).toBe(
      'A payer learns your name and your bank account.'
    );
    expect(payerLearns(['handle_only'], '@cato')).toBe('A payer learns only @cato.');
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
    expect(paymentMethodUrl('upi', 'lena@upi', { value: 500, currency: 'INR' }, 'Lena')).toBe(
      'upi://pay?pa=lena%40upi&pn=Lena&cu=INR&am=500.00'
    );
    expect(paymentMethodUrl('upi', 'lena@upi', { value: 5, currency: 'CHF' }, 'Lena')).toBe(
      'upi://pay?pa=lena%40upi&pn=Lena&cu=INR'
    );
    const zec = 't1' + 'A'.repeat(33);
    expect(paymentMethodUrl('zcash', zec)).toBe(`zcash:${zec}`);
  });

  it('has no link for a handle that is copied into an app', () => {
    expect(paymentMethodUrl('twint', '+41791234567')).toBe('');
    expect(paymentMethodUrl('bank', 'CH9300762011623852957')).toBe('');
    expect(paymentMethodUrl('pix', 'lena@example.com')).toBe('');
    expect(paymentMethodUrl('other', 'lena')).toBe('');
    expect(paymentMethodUrl('other', 'https://pay.example/lena')).toBe('https://pay.example/lena');
    expect(paymentMethodUrl('tikkie', 'https://tikkie.me/pay/abc')).toBe(
      'https://tikkie.me/pay/abc'
    );
  });
});

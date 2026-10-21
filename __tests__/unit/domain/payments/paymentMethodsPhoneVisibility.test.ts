/**
 * A phone-number rail is shared on request, whatever the caller sends.
 * The add sheet picks this already; the server enforces it so an API call
 * without `visibility`, or with `public`, cannot publish a phone number.
 */

import { visibilityFor } from '@/domain/payments/paymentMethodsService';
import { PAYMENT_METHODS, type PaymentMethodId } from '@/config/payment-methods';

const ids = Object.keys(PAYMENT_METHODS) as PaymentMethodId[];
const phoneRails = ids.filter(id => PAYMENT_METHODS[id].reveals.includes('phone'));
const otherRails = ids.filter(id => !PAYMENT_METHODS[id].reveals.includes('phone'));

describe('visibilityFor', () => {
  it('has phone rails to protect (twint among them)', () => {
    expect(phoneRails).toContain('twint');
  });

  it.each(phoneRails)('%s is on request even when public is asked for', id => {
    expect(visibilityFor(id, 'public')).toBe('on_request');
    expect(visibilityFor(id, undefined)).toBe('on_request');
    expect(visibilityFor(id, 'on_request')).toBe('on_request');
  });

  it.each(otherRails)('%s keeps the caller choice, public by default', id => {
    expect(visibilityFor(id, undefined)).toBe('public');
    expect(visibilityFor(id, 'public')).toBe('public');
    expect(visibilityFor(id, 'on_request')).toBe('on_request');
  });
});

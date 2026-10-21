/**
 * A handle shared on request never leaves the server for a public reader.
 * The page shows the rail by name and an Ask button; the number or IBAN is
 * not in the response at all, so no client-side slip can print it.
 */

import { toPublicPaymentMethod } from '@/domain/payments/paymentMethodsService';

const row = {
  id: 'm1',
  method: 'twint' as const,
  handle: '+41791234567',
  label: null,
  display_order: 0,
  is_active: true,
};

describe('toPublicPaymentMethod', () => {
  it('keeps the handle of a public row', () => {
    expect(toPublicPaymentMethod({ ...row, visibility: 'public' })).toEqual({
      id: 'm1',
      method: 'twint',
      handle: '+41791234567',
      label: null,
      visibility: 'public',
    });
  });

  it('strips the handle of a row shared on request', () => {
    const shown = toPublicPaymentMethod({ ...row, visibility: 'on_request' });
    expect(shown.handle).toBeNull();
    expect(shown.visibility).toBe('on_request');
    expect(JSON.stringify(shown)).not.toContain('4179');
  });
});

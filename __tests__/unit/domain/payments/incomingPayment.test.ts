/**
 * The row settlement writes becomes a moment on the Receive screen. Reading it
 * has to be strict about what counts as one: only a payment, only with a real
 * amount — a message or a follow arriving while the code is on screen must
 * never flip it to "Received".
 */

import { incomingPaymentFrom } from '@/domain/payments/incomingPayment';

describe('incomingPaymentFrom', () => {
  it('reads the amount, who paid and what for', () => {
    expect(
      incomingPaymentFrom({
        id: 'n1',
        type: 'payment',
        metadata: { amount_btc: 0.0002, payerName: 'Marco', note: 'dinner', title: 'x' },
      })
    ).toEqual({ id: 'n1', amountBtc: 0.0002, from: 'Marco', note: 'dinner' });
  });

  it('is fine with an anonymous payer', () => {
    expect(
      incomingPaymentFrom({ id: 'n2', type: 'payment', metadata: { amount_btc: 0.001 } })
    ).toEqual({ id: 'n2', amountBtc: 0.001, from: null, note: null });
  });

  it('ignores anything that is not a payment with an amount', () => {
    expect(
      incomingPaymentFrom({ id: 'a', type: 'message', metadata: { amount_btc: 1 } })
    ).toBeNull();
    expect(incomingPaymentFrom({ id: 'b', type: 'payment', metadata: {} })).toBeNull();
    expect(
      incomingPaymentFrom({ id: 'c', type: 'payment', metadata: { amount_btc: 0 } })
    ).toBeNull();
    expect(
      incomingPaymentFrom({ id: 'd', type: 'payment', metadata: { amount_btc: 'lots' } })
    ).toBeNull();
    expect(incomingPaymentFrom({ id: 'e', type: 'payment', metadata: null })).toBeNull();
  });
});

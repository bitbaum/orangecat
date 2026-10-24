import { requestAmountLabel } from '@/components/requests/request-amount';

const inBtc = (btc: number) => `${btc} BTC`;

describe('requestAmountLabel', () => {
  it('words an ask made in a currency as it was asked', () => {
    expect(
      requestAmountLabel({ amount_btc: 0.0002, ask_amount: 20, ask_currency: 'CHF' }, inBtc)
    ).toBe('CHF 20.00');
  });

  it('leaves an ask made in BTC to the reader’s own currency', () => {
    expect(
      requestAmountLabel({ amount_btc: 0.0002, ask_amount: null, ask_currency: null }, inBtc)
    ).toBe('0.0002 BTC');
  });
});

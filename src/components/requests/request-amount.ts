import { formatCurrency } from '@/services/currency/formatting';
import type { PaymentRequestRow } from '@/services/payment-requests/request-client';

/**
 * A request's amount in the words it was asked in. An ask made in francs reads
 * "CHF 20.00" for as long as it is open; one made in BTC is shown by the
 * reader's own currency, as everywhere else.
 */
export function requestAmountLabel(
  row: Pick<PaymentRequestRow, 'amount_btc' | 'ask_amount' | 'ask_currency'>,
  formatAmountBtc: (btc: number) => string
): string {
  return row.ask_amount && row.ask_currency
    ? formatCurrency(Number(row.ask_amount), row.ask_currency)
    : formatAmountBtc(row.amount_btc);
}

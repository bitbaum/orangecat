/**
 * What a "you were paid" notification says, read as a moment.
 *
 * Settlement writes one notification per payment (paymentSettlement,
 * paymentRequestService), carrying the amount in its metadata. The Receive
 * screen listens for those and turns the code into a confirmation while the
 * payer is still standing there. This is the one place that reads the row, so
 * the screen never learns the notification's shape.
 */

export interface IncomingPayment {
  /** Always BTC, the canonical unit; the screen words it in the owner's currency. */
  amountBtc: number;
  /** Who paid, when we know (a request someone paid, or a signed-in payer). */
  from: string | null;
  /** What it was for, when the payer or the request said. */
  note: string | null;
  /** The notification it came from — a re-delivered row is the same payment. */
  id: string;
}

interface NotificationRowLike {
  id: string;
  type: string;
  metadata?: Record<string, unknown> | null;
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

export function incomingPaymentFrom(row: NotificationRowLike): IncomingPayment | null {
  if (row.type !== 'payment') {
    return null;
  }
  const meta = row.metadata ?? {};
  const amountBtc = Number(meta.amount_btc);
  if (!Number.isFinite(amountBtc) || amountBtc <= 0) {
    return null;
  }
  return { id: row.id, amountBtc, from: text(meta.payerName), note: text(meta.note) };
}

// @vitest-environment jsdom
/**
 * A request row: two actions beside the text squeezed the note to "Dinn…".
 * Pay and Decline now sit under the text as two equal cells; a row with one
 * action keeps it beside the text.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { RequestList } from '@/components/requests/RequestList';
import { REQUEST_COPY } from '@/config/payment-requests';
import type { PaymentRequestRow } from '@/services/payment-requests/request-client';
import { Inbox } from 'lucide-react';

vi.mock('@/hooks/useDisplayCurrency', () => ({
  useDisplayCurrency: () => ({ formatAmountBtc: (btc: number) => `${btc} BTC` }),
}));

afterEach(cleanup);

const ROW: PaymentRequestRow = {
  id: 'r1',
  requester_id: 'a',
  payer_id: 'b',
  amount_btc: 0.0002,
  ask_amount: null,
  ask_currency: null,
  note: 'Dinner on Friday at the place by the lake',
  status: 'pending',
  created_at: '2026-11-01T00:00:00Z',
  paid_at: null,
  counterparty_username: 'mao',
  counterparty_name: 'Mao',
};

function renderList(direction: 'incoming' | 'outgoing') {
  render(
    <RequestList
      title="t"
      emptyText="none"
      emptyIcon={Inbox}
      rows={[ROW]}
      direction={direction}
      onClose={() => undefined}
    />
  );
}

describe('RequestList rows', () => {
  it('puts Pay and Decline under the text as two equal cells', () => {
    renderList('incoming');
    const pay = screen.getByRole('link', { name: REQUEST_COPY.pay });
    const decline = screen.getByRole('button', { name: REQUEST_COPY.decline });
    expect(pay.parentElement).toBe(decline.parentElement);
    expect(pay.parentElement?.className).toContain('grid-cols-2');
  });

  it('keeps a single action beside the text', () => {
    renderList('outgoing');
    const cancel = screen.getByRole('button', { name: REQUEST_COPY.cancel });
    expect(cancel.parentElement?.className).not.toContain('grid-cols-2');
  });

  it('gives the status line no stray paragraph margin', () => {
    renderList('incoming');
    expect(screen.getByText(REQUEST_COPY.statusLabels.pending).className).toContain('mb-0');
  });
});

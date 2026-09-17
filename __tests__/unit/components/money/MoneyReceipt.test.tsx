// @vitest-environment jsdom
/**
 * The confirmation screen is the one place a money app cannot bluff. It may
 * state only what it actually knows — an amount we were never told must be
 * omitted, not rendered as a zero or a blank row that reads like a failure.
 */

import { render, screen } from '@testing-library/react';
import { MoneyReceipt } from '@/components/money/MoneyReceipt';

vi.mock('@/hooks/useDisplayCurrency', () => ({
  useDisplayCurrency: () => ({ formatAmountBtc: (btc: number) => `${btc} BTC` }),
}));

const vibrate = vi.fn();

beforeAll(() => {
  Object.defineProperty(navigator, 'vibrate', { writable: true, value: vibrate });
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  });
});

beforeEach(() => vi.clearAllMocks());

describe('MoneyReceipt', () => {
  it('states the amount and who it went to', () => {
    render(<MoneyReceipt title="Sent" amountBtc={0.0005} counterparty="Lena Brunner" />);

    expect(screen.getByText('Sent')).toBeInTheDocument();
    expect(screen.getByText('0.0005 BTC')).toBeInTheDocument();
    expect(screen.getByText('Lena Brunner')).toBeInTheDocument();
  });

  it('omits the amount entirely when the payment never revealed one', () => {
    render(
      <MoneyReceipt
        title="Sent"
        amountBtc={null}
        counterparty={null}
        fallbackBody="It went through."
      />
    );

    expect(screen.queryByText(/BTC/)).not.toBeInTheDocument();
    expect(screen.getByText('It went through.')).toBeInTheDocument();
  });

  it('drops a missing note rather than showing an empty row', () => {
    render(<MoneyReceipt title="Sent" amountBtc={0.001} counterparty="Marco" note={null} />);

    expect(screen.queryByText('For')).not.toBeInTheDocument();
  });

  it('confirms through touch as well as sight', () => {
    render(<MoneyReceipt title="Sent" amountBtc={0.001} counterparty="Marco" />);

    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('labels the counterparty by direction', () => {
    render(
      <MoneyReceipt title="Paid" amountBtc={0.001} counterparty="Lena" counterpartyLabel="From" />
    );

    expect(screen.getByText('From')).toBeInTheDocument();
  });
});

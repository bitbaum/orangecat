// @vitest-environment jsdom
/**
 * A loan page spoke dollars to a Swiss visitor, with no Bitcoin figure, and a
 * new request read like a refinance: "Remaining Balance $500.00 · Original:
 * $500.00", "Loan Type: Request New Loan" (full-path review 2026-11-13,
 * money#8 / create#14).
 */

import { render, screen } from '@testing-library/react';
import { ViewerAmount } from '@/components/ui/ViewerAmount';
import { loanDetailConfig } from '@/components/public/detail-configs/loan';
import { applyRateSnapshot, cache } from '@/services/currency/rates';

const viewer = { currency: 'CHF' };
vi.mock('@/hooks/useDisplayCurrency', async () => {
  const { formatCurrency } = await import('@/services/currency');
  const { getRate } = await import('@/services/currency/rates');
  return {
    useDisplayCurrency: () => ({
      displayCurrency: viewer.currency,
      formatAmountBtc: (btc: number) =>
        viewer.currency === 'BTC'
          ? formatCurrency(btc, 'BTC')
          : formatCurrency(btc * (getRate(viewer.currency) ?? 0), viewer.currency),
    }),
  };
});

beforeEach(() => {
  viewer.currency = 'CHF';
  cache.rates = {};
  applyRateSnapshot({ rates: { CHF: 80000, USD: 100000 }, fetchedAt: Date.now() });
});

describe('ViewerAmount', () => {
  it('shows a dollar amount in the viewer’s francs, keeping what was listed and the BTC', () => {
    render(<ViewerAmount amount={500} currency="USD" detail />);
    expect(screen.getByText(/≈ CHF\s?400\.00/)).toBeTruthy();
    expect(screen.getByText(/Listed as/).textContent).toMatch(/500\.00.*0\.005/);
  });

  it('shows an amount already in the viewer’s currency as it is', () => {
    render(<ViewerAmount amount={250} currency="CHF" />);
    expect(screen.getByText(/CHF\s?250\.00/).textContent).not.toContain('≈');
  });

  it('keeps the stored amount when there is no rate', () => {
    cache.rates = {};
    render(<ViewerAmount amount={500} currency="USD" />);
    expect(screen.getByText(/500\.00/).textContent).not.toContain('≈');
  });
});

describe('a new loan request', () => {
  const request = {
    id: 'loan-2',
    created_at: '2026-08-01T00:00:00Z',
    currency: 'USD',
    original_amount: 500,
    remaining_balance: 500,
    loan_type: 'new_request',
  };

  it('says what is asked for, not a balance against an original', () => {
    render(<div>{loanDetailConfig.renderDetails?.(request)}</div>);
    expect(screen.getByText('Asking for')).toBeTruthy();
    expect(screen.queryByText(/Remaining/i)).toBeNull();
    expect(screen.queryByText(/Original/)).toBeNull();
  });

  it('names its type as a kind, not a button', () => {
    render(<div>{loanDetailConfig.renderSidebarExtra?.(request, false, false, null)}</div>);
    expect(screen.getByText('New loan')).toBeTruthy();
    expect(screen.queryByText('Request New Loan')).toBeNull();
  });
});

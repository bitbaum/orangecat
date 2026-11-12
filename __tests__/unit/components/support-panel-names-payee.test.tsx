// @vitest-environment jsdom
/**
 * The anonymous "Support with Bitcoin" card said "You will pay Remise Rosa in
 * Zürich directly" and "It goes straight to Remise Rosa in Zürich's wallet" —
 * the listing's title — while the money settles in a wallet of the owner's
 * (one tied to the listing, else their own; a group's for a group). Seen on
 * cause, project and product pages on production, 2026-11-12. The card now
 * names the payee and keeps the listing as what the payment is for.
 */
import { render, screen } from '@testing-library/react';
import { PublicSupportPanel, supportPayeeLines } from '@/components/payment/PublicSupportPanel';

vi.mock('@/hooks/usePublicPayment', () => ({
  usePublicPayment: () => ({ phase: 'choose', start: vi.fn() }),
}));
vi.mock('@/components/payment/PublicPaymentProgress', () => ({
  PublicPaymentProgress: () => null,
}));
vi.mock('@/components/money/AmountField', () => ({ AmountField: () => null }));

describe('support card payee', () => {
  it('names the person who receives the money, and what it is for', () => {
    render(
      <PublicSupportPanel
        entityType="cause"
        entityId="c1"
        entityTitle="Remise Rosa in Zürich"
        recipientName="Cato"
      />
    );
    expect(
      screen.getByText('You pay Cato directly for Remise Rosa in Zürich; no account is required.')
    ).toBeTruthy();
    expect(
      screen.getByText("OrangeCat never holds the money. It goes straight to Cato's wallet.")
    ).toBeTruthy();
    expect(screen.queryByText(/Remise Rosa in Zürich's wallet/)).toBeNull();
  });

  it('a group receives in its own name, said once', () => {
    expect(supportPayeeLines('Zurich Makers', 'Zurich Makers').intro).toBe(
      'You pay Zurich Makers directly; no account is required.'
    );
  });

  it('says "the owner" rather than inventing a payee when none is known', () => {
    const lines = supportPayeeLines('Remise Rosa in Zürich', null);
    expect(lines.intro).toBe(
      'You pay the owner directly for Remise Rosa in Zürich; no account is required.'
    );
    expect(lines.custody).toBe(
      "OrangeCat never holds the money. It goes straight to the owner's wallet."
    );
  });
});

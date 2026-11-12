// @vitest-environment jsdom
/**
 * An asset's rental terms read as a count of its own unit.
 *
 * The Minimum and Maximum Period rows glued the count to the select's cadence
 * label, so a studio rented by the day read "Minimum Period 1 Per Day" on
 * orangecat.ch, and a two-day maximum would have read "2 Per Days". The price
 * row said "/ Per Day" — a slash and a "per" for the same word.
 */

import { render, screen } from '@testing-library/react';
import { assetDetailConfig } from '@/components/public/detail-configs/asset';

// Server component reading its own rows, and the booking dialog: neither is
// about the rental terms this file pins.
vi.mock('@/components/public/detail-configs/AssetEventsCard', () => ({
  AssetEventsCard: () => null,
}));
vi.mock('@/components/bookings/BookEntityButton', () => ({ BookEntityButton: () => null }));

const rental = {
  id: 'asset-1',
  title: 'Studio',
  is_for_rent: true,
  rental_period_type: 'daily',
  min_rental_period: 1,
  max_rental_period: 2,
};

function renderAsset(entity: Record<string, unknown>) {
  render(<div>{assetDetailConfig.renderDetails?.(entity, null, false, false)}</div>);
}

describe('asset detail config — rental periods', () => {
  it('counts the minimum and maximum in days, singular and plural', () => {
    renderAsset(rental);

    expect(screen.getByText('1 day')).toBeInTheDocument();
    expect(screen.getByText('2 days')).toBeInTheDocument();
    expect(screen.queryByText(/Per Day/)).not.toBeInTheDocument();
  });

  it.each([
    ['hourly', '3 hours'],
    ['weekly', '3 weeks'],
    ['monthly', '3 months'],
  ])('counts a %s rental in its own unit', (periodType, expected) => {
    renderAsset({ ...rental, rental_period_type: periodType, min_rental_period: 3 });
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('prices per unit without a second "per"', () => {
    renderAsset({ ...rental, rental_period_type: 'hourly', rental_price_btc: 0.0001 });

    expect(screen.getByText(/\/ hour$/)).toBeInTheDocument();
    expect(screen.queryByText(/Per Hour/)).not.toBeInTheDocument();
  });

  it('falls back to "period" when the cadence is unknown', () => {
    renderAsset({ ...rental, rental_period_type: null, max_rental_period: null });
    expect(screen.getByText('1 period')).toBeInTheDocument();
  });
});

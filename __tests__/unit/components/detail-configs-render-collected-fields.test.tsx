// @vitest-environment jsdom
/**
 * A field a user fills in must appear on the page that shows the entity.
 *
 * Both regressions pinned here shipped and stayed invisible for the same reason:
 * the section rendered SOME of what the form collected, so it looked complete.
 *
 *   - Loans: the refinance form asks for the current rate and the desired rate —
 *     the two numbers that define a refinance — and the public loan page showed
 *     neither, while showing `monthly_payment` from that same form section. A
 *     lender could not see the spread they were being asked to beat.
 *   - Events: the form collects a full postal address, and the page rendered
 *     only the free-text `location`, so attendees could not find the venue. The
 *     online join link had the same fate.
 *
 * The class is gated by scripts/check-dead-fields.mjs; these are the instances.
 */

import { render, screen } from '@testing-library/react';
import { loanDetailConfig } from '@/components/public/detail-configs/loan';
import { eventDetailConfig } from '@/components/public/detail-configs/event';
import { serviceDetailConfig } from '@/components/public/detail-configs/service';
import { investmentDetailConfig } from '@/components/public/detail-configs/investment';

describe('loan detail config', () => {
  const refinance = {
    id: 'loan-1',
    created_at: '2026-08-01T00:00:00Z',
    currency: 'CHF',
    original_amount: 10000,
    remaining_balance: 8000,
    loan_type: 'existing_refinance',
    current_lender: 'Zürcher Kantonalbank',
    current_interest_rate: 8.5,
    desired_rate: 5,
    monthly_payment: 500,
  };

  it('shows the current and desired rates a refinance is asking for', () => {
    render(<div>{loanDetailConfig.renderDetails?.(refinance)}</div>);

    expect(screen.getByText('Current Rate')).toBeInTheDocument();
    expect(screen.getByText('8.5% APR')).toBeInTheDocument();
    expect(screen.getByText('Desired Rate')).toBeInTheDocument();
    expect(screen.getByText('5% APR')).toBeInTheDocument();
    expect(screen.getByText(/3\.5 percentage point reduction/)).toBeInTheDocument();
  });

  it('reads the lender from the column the create form actually writes', () => {
    render(<div>{loanDetailConfig.renderDetails?.(refinance)}</div>);
    expect(screen.getByText(/Zürcher Kantonalbank/)).toBeInTheDocument();
  });

  it('falls back to lender_name, which lender-created obligations write instead', () => {
    render(
      <div>
        {loanDetailConfig.renderDetails?.({
          ...refinance,
          current_lender: null,
          lender_name: 'Private Lender',
        })}
      </div>
    );
    expect(screen.getByText(/Private Lender/)).toBeInTheDocument();
  });

  it('still shows the refinance terms when loan_type was never set', () => {
    render(<div>{loanDetailConfig.renderDetails?.({ ...refinance, loan_type: null })}</div>);
    expect(screen.getByText('8.5% APR')).toBeInTheDocument();
  });

  it('omits the refinance block entirely for a plain new-loan request', () => {
    render(
      <div>
        {loanDetailConfig.renderDetails?.({
          ...refinance,
          loan_type: 'new_request',
          current_interest_rate: null,
          desired_rate: null,
        })}
      </div>
    );
    expect(screen.queryByText('Refinancing')).not.toBeInTheDocument();
  });
});

describe('event detail config', () => {
  const event = {
    id: 'event-1',
    start_date: '2026-09-01T18:00:00Z',
    location: 'Community Center',
    venue_name: 'Community Center',
    venue_address: 'Bahnhofstrasse 1',
    venue_city: 'Zurich',
    venue_postal_code: '8001',
    venue_country: 'Switzerland',
    rsvp_deadline: '2026-08-28T18:00:00Z',
  };

  it('shows the postal address, not just the free-text location', () => {
    render(<div>{eventDetailConfig.renderDetails?.(event)}</div>);

    expect(screen.getByText('Bahnhofstrasse 1')).toBeInTheDocument();
    expect(screen.getByText('8001 Zurich')).toBeInTheDocument();
    expect(screen.getByText('Switzerland')).toBeInTheDocument();
  });

  it('shows the RSVP deadline the form asks for', () => {
    render(<div>{eventDetailConfig.renderDetails?.(event)}</div>);
    expect(screen.getByText(/RSVP by August 28, 2026/)).toBeInTheDocument();
  });

  it('links an online event to its join URL', () => {
    render(
      <div>
        {eventDetailConfig.renderDetails?.({
          ...event,
          online_url: 'https://meet.jit.si/BitcoinZurich',
        })}
      </div>
    );
    expect(screen.getByRole('link', { name: 'Join online' })).toHaveAttribute(
      'href',
      'https://meet.jit.si/BitcoinZurich'
    );
  });

  it('drops a join URL carrying a script scheme instead of linking it', () => {
    render(
      <div>
        {eventDetailConfig.renderDetails?.({
          ...event,
          // eslint-disable-next-line no-script-url
          online_url: 'javascript:alert(1)',
        })}
      </div>
    );
    expect(screen.queryByRole('link', { name: 'Join online' })).not.toBeInTheDocument();
  });
});

describe('event recurrence', () => {
  const base = {
    id: 'event-2',
    created_at: '2026-08-01T00:00:00Z',
    title: 'Weekly standup',
    start_date: '2026-09-01T17:00:00Z',
  };

  it('says how often a repeating event repeats, and on which days', () => {
    render(
      <div>
        {eventDetailConfig.renderDetails?.({
          ...base,
          is_recurring: true,
          recurrence_pattern: {
            frequency: 'weekly',
            interval: 2,
            days_of_week: ['monday', 'wednesday'],
          },
        })}
      </div>
    );
    expect(screen.getByText('Every 2 weeks on Mon, Wed')).toBeInTheDocument();
  });

  it('renders the rule even when is_recurring was never set', () => {
    render(
      <div>
        {eventDetailConfig.renderDetails?.({
          ...base,
          recurrence_pattern: { frequency: 'monthly', day_of_month: 3 },
        })}
      </div>
    );
    expect(screen.getByText('Every month on the 3rd')).toBeInTheDocument();
  });

  it('shows nothing for a one-off event', () => {
    render(<div>{eventDetailConfig.renderDetails?.({ ...base, is_recurring: false })}</div>);
    expect(screen.queryByText(/^Every /)).not.toBeInTheDocument();
    expect(screen.queryByText('Repeats')).not.toBeInTheDocument();
  });

  it('links a video URL', () => {
    render(
      <div>{eventDetailConfig.renderDetails?.({ ...base, video_url: 'https://ex.tld/v' })}</div>
    );
    expect(screen.getByRole('link', { name: 'Watch the video' })).toHaveAttribute(
      'href',
      'https://ex.tld/v'
    );
  });
});

describe('service location', () => {
  // Deliberately priceless. PriceDisplay suspends under jsdom (no app providers
  // or Suspense boundary), and an unresolved suspense discards the WHOLE card —
  // silently, with no thrown error, so the assertion fails as "text not found"
  // and reads like a missing render. Production is fine: the live page for a
  // priced service returns 200 with Price/Duration/Book this present, checked
  // directly. Location fields do not depend on price, so leaving it out tests
  // exactly what changed instead of mocking a component this file does not own.
  const service = {
    id: 'svc-1',
    created_at: '2026-08-01T00:00:00Z',
    title: 'Roof repair',
    currency: 'CHF',
  };

  it('shows how the service is delivered and how far the provider travels', () => {
    render(
      <div>
        {serviceDetailConfig.renderDetails?.({
          ...service,
          service_location_type: 'onsite',
          service_area: 'Zürich and Winterthur',
        })}
      </div>
    );
    expect(screen.getByText('On-site Only')).toBeInTheDocument();
    expect(screen.getByText('Zürich and Winterthur')).toBeInTheDocument();
  });
});

describe('loan term', () => {
  it('shows origination, maturity and the lender reference', () => {
    render(
      <div>
        {loanDetailConfig.renderDetails?.({
          id: 'loan-2',
          created_at: '2026-08-01T00:00:00Z',
          currency: 'CHF',
          // Required by the loan schema (z.number().positive()) and read
          // unguarded by the Financial Details card — a fixture without them
          // exercises a state no stored loan can be in.
          original_amount: 10000,
          remaining_balance: 8000,
          origination_date: '2024-03-15',
          maturity_date: '2034-03-15',
          loan_number: 'ZKB-99812',
        })}
      </div>
    );
    expect(screen.getByText('15 March 2024')).toBeInTheDocument();
    expect(screen.getByText('15 March 2034')).toBeInTheDocument();
    expect(screen.getByText('ZKB-99812')).toBeInTheDocument();
  });

  it('falls back to the raw string rather than printing Invalid Date', () => {
    render(
      <div>
        {loanDetailConfig.renderDetails?.({
          id: 'loan-3',
          created_at: '2026-08-01T00:00:00Z',
          currency: 'CHF',
          original_amount: 10000,
          remaining_balance: 8000,
          maturity_date: 'whenever the roof is done',
        })}
      </div>
    );
    expect(screen.getByText('whenever the roof is done')).toBeInTheDocument();
  });
});

describe('investment return cadence', () => {
  const base = {
    id: 'inv-1',
    created_at: '2026-08-01T00:00:00Z',
    currency: 'BTC',
    target_amount: 1,
    minimum_investment: 0.01,
    expected_return_rate: 12,
  };

  it('shows how often the return is paid, not just the rate', () => {
    render(
      <div>
        {investmentDetailConfig.renderDetails?.({ ...base, return_frequency: 'quarterly' })}
      </div>
    );
    // The rate was already rendered; the cadence beside it is what was missing.
    expect(screen.getByText('12.0%')).toBeInTheDocument();
    expect(screen.getByText('Return Paid')).toBeInTheDocument();
    expect(screen.getByText('Quarterly')).toBeInTheDocument();
  });

  it('falls back to the stored value if the options list ever drifts', () => {
    render(
      <div>
        {investmentDetailConfig.renderDetails?.({ ...base, return_frequency: 'fortnightly' })}
      </div>
    );
    expect(screen.getByText('fortnightly')).toBeInTheDocument();
  });

  it('renders no cadence row when the investment did not state one', () => {
    render(
      <div>{investmentDetailConfig.renderDetails?.({ ...base, return_frequency: null })}</div>
    );
    expect(screen.queryByText('Return Paid')).not.toBeInTheDocument();
  });
});

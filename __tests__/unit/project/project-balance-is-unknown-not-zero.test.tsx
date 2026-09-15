// @vitest-environment jsdom
/**
 * A project's "Bitcoin Balance" read 0.00 on every project on the platform,
 * forever — and not because the addresses were empty.
 *
 * `projects.bitcoin_balance_btc` WAS NEVER A COLUMN. The page selects `*`, the
 * field comes back `undefined`, and `project.bitcoin_balance_btc || 0` turns
 * that into a confident zero rendered beside a real funding address. The
 * owner-only "Refresh Balance" button could not repair it either: its route
 * names the missing column in a select list, PostgREST answers 42703, and the
 * handler maps that to "Project not found". So the number was unfixable AND
 * unfalsifiable from the UI.
 *
 * This is the same bug #946 fixed one level down for wallet cards — "an
 * unchecked balance is unknown, not zero", a fabricated zero presented as
 * freshly read from the blockchain. A project holding Bitcoin looked empty, and
 * a visitor deciding whether to fund it saw a lie in the project's favour
 * either way.
 *
 * The migration adds both columns as NULLABLE and does NOT default them to 0,
 * because NULL is the state the old code could not express: nobody has ever
 * asked the chain. `bitcoin_balance_updated_at` is the only honest witness that
 * a lookup happened, so it — not the number — decides what renders.
 */

import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useDisplayCurrency', () => ({
  useDisplayCurrency: () => ({
    formatAmountBtc: (n: number) => `₿${n}`,
    formatPrice: (n: number, c: string) => `${c} ${n}`,
    formatSats: (n: number) => `${n}`,
  }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ProjectSummaryRail from '@/components/project/ProjectSummaryRail';

const project = {
  id: 'p-1',
  goal_amount: 1200,
  goal_currency: 'CHF',
  bitcoin_address: 'bc1qexampleaddressthatisnotreal0000000000',
};

describe('project Bitcoin Balance', () => {
  it('renders an em dash, not a zero, when the chain was never read', () => {
    render(<ProjectSummaryRail project={{ ...project, bitcoin_balance_updated_at: null }} />);

    expect(screen.getByText('Bitcoin Balance')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Not checked yet')).toBeInTheDocument();

    // The precise regression: a formatted zero must not appear as the balance.
    // `₿0` is what the mocked formatter produces for the old `|| 0` path.
    expect(screen.queryByText('₿0')).not.toBeInTheDocument();
  });

  it('renders the balance once a real lookup has happened', () => {
    render(
      <ProjectSummaryRail
        project={{
          ...project,
          bitcoin_balance_btc: 0.0006058,
          bitcoin_balance_updated_at: '2026-09-15T12:00:00.000Z',
        }}
      />
    );

    expect(screen.getByText('₿0.0006058')).toBeInTheDocument();
    expect(screen.queryByText('Not checked yet')).not.toBeInTheDocument();
  });

  it('still says unknown when a balance is present but no lookup is witnessed', () => {
    // A stored number with no timestamp is exactly the shape a bad backfill or
    // a default-to-zero column produces. It must not be trusted: without
    // `bitcoin_balance_updated_at` nothing proves any address was ever read.
    render(
      <ProjectSummaryRail
        project={{ ...project, bitcoin_balance_btc: 0, bitcoin_balance_updated_at: null }}
      />
    );

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('₿0')).not.toBeInTheDocument();
  });

  it('shows no Bitcoin Balance block at all for a project with no address', () => {
    render(<ProjectSummaryRail project={{ ...project, bitcoin_address: null }} />);
    expect(screen.queryByText('Bitcoin Balance')).not.toBeInTheDocument();
  });
});

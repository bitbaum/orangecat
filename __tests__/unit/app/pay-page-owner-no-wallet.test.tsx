// @vitest-environment jsdom
/**
 * An owner opening their own pay page before they have a wallet.
 *
 * On orangecat.ch (2026-11-12, 390px, both themes) the owner of a page with no
 * way to pay saw the payer's dead end: "<their name> hasn't added a Bitcoin
 * wallet yet" and one link, "Message <their name> to suggest adding one",
 * which opened a message to their own profile. Nothing led to /receive, where
 * a wallet is added. The owner now gets their own line and that way forward;
 * everyone else still gets the nudge.
 */
import { render, screen } from '@testing-library/react';
import { PayPageClient } from '@/app/(public)/pay/[username]/PayPageClient';
import { PAY_COPY } from '@/config/pay';
import { ROUTES } from '@/config/routes';
import { SEND_COPY } from '@/config/send';

let viewerId: string | null = null;
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: viewerId ? { id: viewerId } : null }),
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/pay/cato',
}));

const noWayToPay = {
  username: 'cato',
  recipientName: 'Cato',
  recipientId: 'owner-1',
  canReceive: false,
  methods: [],
};

beforeEach(() => {
  viewerId = null;
});

describe('a pay page with no way to pay', () => {
  it('shows its owner where to add a wallet, not a message to themselves', () => {
    viewerId = 'owner-1';
    render(<PayPageClient {...noWayToPay} />);

    expect(screen.getByText(PAY_COPY.ownerNoWallet)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: PAY_COPY.ownerAddWallet })).toHaveAttribute(
      'href',
      ROUTES.RECEIVE
    );
    expect(screen.queryByText(SEND_COPY.recipientNudge('Cato'))).toBeNull();
    expect(screen.queryByText(PAY_COPY.noWallet('Cato'))).toBeNull();
  });

  it('still lets another signed-in visitor ask the owner to add one', () => {
    viewerId = 'someone-else';
    render(<PayPageClient {...noWayToPay} />);

    expect(screen.getByText(PAY_COPY.noWallet('Cato'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: SEND_COPY.recipientNudge('Cato') })).toHaveAttribute(
      'href',
      ROUTES.MESSAGES_TO('owner-1', 'add-wallet')
    );
    expect(screen.queryByText(PAY_COPY.ownerNoWallet)).toBeNull();
  });

  it('and a signed-out visitor too', () => {
    render(<PayPageClient {...noWayToPay} />);

    expect(
      screen.getByRole('link', { name: SEND_COPY.recipientNudge('Cato') })
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: PAY_COPY.ownerAddWallet })).toBeNull();
  });
});

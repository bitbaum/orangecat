// @vitest-environment jsdom
/**
 * A group page said two things that could not both be true. Measured on
 * production, 2026-11-12, on five public groups at 390px, signed out and signed
 * in as a non-member: the tabs read "Wallets (0)", the Statistics card "0
 * Wallets", the Wallets tab "No wallets yet" — and beside them a live "Support
 * with Bitcoin" card: "It goes straight to Zurich Record Shop's wallet.", an
 * amount and an enabled "Create Bitcoin request".
 *
 * The count was blind: group_wallets is readable by members only, so a visitor
 * always got an empty list. The pay card was never checked against a wallet.
 * The same visitor was offered "Create New Wallet", a form only a founder or an
 * admin can submit. And a member saw a balance nobody had read as "CHF 0.00".
 *
 * Now the server resolves whether the group can be paid (the payment's own
 * resolution) and the page shows the pay card or the shared "hasn't connected a
 * wallet yet" card; a visitor sees no wallet count at all; only founders and
 * admins are offered to add a wallet; an unread balance says so.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { GroupDetail } from '@/components/groups/GroupDetail';
import { GroupWallets } from '@/components/groups/GroupWallets';
import { GroupWalletCard } from '@/components/groups/GroupWalletCard';
import type { GroupWalletSummary } from '@/services/groups/types';

const detail = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/components/groups/useGroupDetail', () => ({ useGroupDetail: () => detail.state }));
vi.mock('@/components/groups/GroupMembers', () => ({ GroupMembers: () => null }));
vi.mock('@/components/groups/proposals/ProposalsList', () => ({ ProposalsList: () => null }));
vi.mock('@/components/groups/events/EventsList', () => ({ EventsList: () => null }));
vi.mock('@/components/groups/GroupActivityFeed', () => ({ GroupActivityFeed: () => null }));
vi.mock('@/components/sharing/EntityShare', () => ({ default: () => null }));
vi.mock('@/components/integrations/LokiBuildCta', () => ({ default: () => null }));
vi.mock('@/hooks/usePublicPayment', () => ({
  usePublicPayment: () => ({ phase: 'choose', start: vi.fn() }),
}));
vi.mock('@/components/payment/PublicPaymentProgress', () => ({
  PublicPaymentProgress: () => null,
}));
vi.mock('@/components/money/AmountField', () => ({ AmountField: () => null }));
vi.mock('@/hooks/useDisplayCurrency', () => ({
  useDisplayCurrency: () => ({ formatAmountBtc: (btc: number) => `BTC ${btc}` }),
}));
vi.mock('@/components/ui/FormattedDate', () => ({
  FormattedDate: ({ value }: { value: string }) => <span>{value}</span>,
}));

const group = {
  id: 'g1',
  slug: 'record-shop',
  name: 'Record Shop',
  description: 'Vinyl, in the heart of town.',
  label: 'company',
  is_public: true,
  visibility: 'public',
  governance_preset: 'consensus',
  created_by: 'founder',
};
const members = [
  { user_id: 'founder', role: 'founder' },
  { user_id: 'member', role: 'member' },
];

function viewAs(
  userId: string | null,
  activeTab = 'overview',
  roleOverride: 'admin' | 'member' | null = null
) {
  const setActiveTab = vi.fn();
  detail.state = {
    user: userId ? { id: userId } : null,
    group,
    members,
    // What the members-only RLS policy hands each viewer: nothing to anyone else.
    wallets: [],
    loading: false,
    error: null,
    activeTab,
    setActiveTab,
    canCreateProposal: false,
    loadGroupData: vi.fn(),
    labelConfig: { name: 'Company' },
    governanceConfig: null,
    LabelIcon: () => null,
    isOwner: userId === 'founder',
    hasGovernanceFeatures: false,
    // The real hook: a listed, public group's content is open to anyone (#1661).
    canSeeContent: true,
    // The hook reads the viewer's own membership row, not the members page.
    viewerRole: userId === 'founder' ? 'founder' : userId === 'member' ? 'member' : roleOverride,
  };
  return setActiveTab;
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('the group page pays only where a wallet can receive', () => {
  it('shows no pay card when the group cannot be paid, and says why', () => {
    viewAs(null);
    render(<GroupDetail groupSlug="record-shop" canReceive={false} />);
    expect(screen.queryByText(/Support with Bitcoin/)).toBeNull();
    expect(screen.queryByText(/It goes straight to/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create Bitcoin request' })).toBeNull();
    expect(screen.getByText("This group hasn't connected a wallet yet.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go to Wallets' })).toBeNull();
  });

  it('shows the pay card when the group can be paid', () => {
    viewAs(null);
    render(<GroupDetail groupSlug="record-shop" canReceive />);
    expect(
      screen.getByText("OrangeCat never holds the money. It goes straight to Record Shop's wallet.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/hasn't connected a wallet yet/)).toBeNull();
  });

  it("points the group's founder at the Wallets tab when nothing can receive", () => {
    const setActiveTab = viewAs('founder');
    render(<GroupDetail groupSlug="record-shop" canReceive={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to Wallets' }));
    expect(setActiveTab).toHaveBeenCalledWith('wallets');
  });
});

describe('the wallet count is only shown to those who can see the wallets', () => {
  it('prints no count to a visitor, signed out or a signed-in non-member', () => {
    for (const viewer of [null, 'stranger']) {
      viewAs(viewer);
      const { unmount } = render(<GroupDetail groupSlug="record-shop" canReceive />);
      // Neither the tab nor the Wallets card carries a number.
      expect(document.body.textContent).not.toMatch(/Wallets \(/);
      const stats = screen.getByText('Statistics').parentElement!.parentElement!;
      expect(within(stats).getByText('Members')).toBeInTheDocument();
      expect(within(stats).queryByText('Wallets')).toBeNull();
      unmount();
    }
  });

  it('prints the count to a member, who can read the list', () => {
    viewAs('member');
    render(<GroupDetail groupSlug="record-shop" canReceive={false} />);
    expect(document.body.textContent).toContain('Wallets (0)');
    const stats = screen.getByText('Statistics').parentElement!.parentElement!;
    expect(within(stats).getByText('Wallets')).toBeInTheDocument();
  });

  it('tells a visitor on the Wallets tab that wallets are for members, not that there are none', () => {
    viewAs(null, 'wallets');
    render(<GroupDetail groupSlug="record-shop" canReceive />);
    expect(screen.getByText('Wallets are visible to members')).toBeInTheDocument();
    expect(screen.queryByText('No wallets yet')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create New Wallet' })).toBeNull();
  });
});

describe('adding a group wallet is offered to founders and admins only', () => {
  it('is not offered to a plain member', () => {
    render(<GroupWallets groupId="g1" groupSlug="record-shop" wallets={[]} canManage={false} />);
    expect(screen.queryByRole('button', { name: 'Create New Wallet' })).toBeNull();
    expect(screen.getByText(/A founder or admin of this group can add/)).toBeInTheDocument();
  });

  it('is offered to a founder, and the empty state names the same button', () => {
    render(<GroupWallets groupId="g1" groupSlug="record-shop" wallets={[]} canManage />);
    expect(screen.getByRole('button', { name: 'Create New Wallet' })).toBeInTheDocument();
    expect(screen.getByText(/Use “Create New Wallet” above/)).toBeInTheDocument();
  });

  it('is offered to an admin who is not among the loaded members (a group of more than 20)', () => {
    // `members` is one page, the 20 newest; this admin joined earlier and is not on it.
    viewAs('early-admin', 'wallets', 'admin');
    render(<GroupDetail groupSlug="record-shop" canReceive={false} />);
    expect(screen.queryByText('Wallets are visible to members')).toBeNull();
    expect(screen.getByRole('button', { name: 'Create New Wallet' })).toBeInTheDocument();
  });

  it('names its close button and ties every label to its field', () => {
    render(<GroupWallets groupId="g1" groupSlug="record-shop" wallets={[]} canManage />);
    fireEvent.click(screen.getByRole('button', { name: 'Create New Wallet' }));
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    for (const label of ['Purpose', 'Description', 'Bitcoin Address', 'Lightning Address']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
  });
});

describe("a group wallet's balance is shown only as far as someone read it", () => {
  const wallet: GroupWalletSummary = {
    id: 'w1',
    name: 'Treasury',
    bitcoin_address: 'bc1qexampleexampleexampleexample',
    current_balance_btc: 0,
    balance_updated_at: null,
    is_active: true,
    can_access: true,
    required_signatures: 1,
  };

  it('says "not checked yet" for a balance nobody read, never a zero', () => {
    render(<GroupWalletCard wallet={wallet} groupSlug="record-shop" canRefresh />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(
      screen.getByText('Not checked yet — refresh to read it from the blockchain')
    ).toBeInTheDocument();
    expect(screen.queryByText('BTC 0')).toBeNull();
    expect(screen.getByRole('button', { name: 'Refresh balance' })).toBeInTheDocument();
  });

  it('shows a read balance with when it was read', () => {
    render(
      <GroupWalletCard
        wallet={{ ...wallet, current_balance_btc: 0, balance_updated_at: '2026-11-12T10:00:00Z' }}
        groupSlug="record-shop"
        canRefresh
      />
    );
    expect(screen.getByText('BTC 0')).toBeInTheDocument();
    expect(screen.getByText(/Updated/)).toBeInTheDocument();
  });

  it('offers no refresh to a member whose refresh could not store it', () => {
    render(<GroupWalletCard wallet={wallet} groupSlug="record-shop" canRefresh={false} />);
    expect(screen.getByText('Not checked yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh balance' })).toBeNull();
  });

  it('shows no balance for a Lightning-only wallet, whose balance no address can tell', () => {
    render(
      <GroupWalletCard
        wallet={{ ...wallet, bitcoin_address: undefined, lightning_address: 'shop@getalby.com' }}
        groupSlug="record-shop"
        canRefresh
      />
    );
    expect(screen.queryByText('Balance')).toBeNull();
    expect(screen.queryByText('BTC 0')).toBeNull();
  });
});

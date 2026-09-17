// @vitest-environment jsdom
/**
 * What a VISITOR receives is not what the owner receives, and this section was
 * written against the owner's shape.
 *
 * GET /api/wallets serves non-owners a curated PUBLIC_WALLET_FIELDS list. It
 * omits `is_active` and `balance_btc` — deliberately, so raw wallet internals
 * are not enumerable. Two consequences met here:
 *
 *   - the section filtered `w => w.is_active`, which for a visitor tested
 *     `undefined` and dropped every wallet. The heading rendered and not one
 *     card beneath it. (The API already filters is_active server-side, so the
 *     client-side filter was a second, wrong copy of that rule.)
 *   - the balance block formatted `wallet.balance_btc` unconditionally, and
 *     formatCurrency(Number(undefined),'BTC') is the literal string "₿NaN".
 *
 * Neither was visible until the Wallets tab itself started appearing again
 * (walletCount was permanently 0 — see check-rpc-exists.mjs), which is why a
 * fix to the tab had to come with this one.
 *
 * The rule both halves encode: a value we did not fetch is not a value of zero.
 */

import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useDisplayCurrency', () => ({
  useDisplayCurrency: () => ({
    formatAmountBtc: (n: number) => `₿${n}`,
    formatPrice: (n: number, c: string) => `${c} ${n}`,
    formatSats: (n: number) => `${n}`,
  }),
}));

vi.mock('@/hooks/useCurrencyConversion', () => ({
  useCurrencyConversion: () => ({ convertFromBTC: () => 0, convertToBTC: () => 0 }),
}));

vi.mock('qrcode.react', () => ({ QRCodeSVG: () => null }));

import ProfileWalletSection from '@/components/profile/ProfileWalletSection';

/** Exactly the shape GET /api/wallets returns to a non-owner. */
const publicWallet = {
  id: 'w-1',
  address_or_xpub: null,
  wallet_type: 'xpub',
  label: 'General',
  category: 'general',
  category_icon: '💰',
  lightning_address: null,
  is_primary: false,
  display_order: 0,
  profile_id: 'p-1',
  project_id: null,
} as never;

function renderSection(wallets: never[]) {
  return render(<ProfileWalletSection wallets={wallets} loading={false} isOwnProfile={false} />);
}

describe('ProfileWalletSection with a visitor-shaped payload', () => {
  it('renders the wallet card — the missing is_active must not delete it', () => {
    renderSection([publicWallet]);
    expect(screen.getByText('Support This Profile')).toBeInTheDocument();
    // The card's own heading — 'General' alone matches the category label too.
    expect(screen.getByRole('heading', { level: 4, name: 'General' })).toBeInTheDocument();
    expect(screen.getByText('💰')).toBeInTheDocument();
  });

  it('never prints a balance it was not given', () => {
    renderSection([publicWallet]);
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(screen.queryByText('Current Balance')).not.toBeInTheDocument();
  });

  it('shows the owner a balance that WAS fetched', () => {
    render(
      <ProfileWalletSection
        wallets={[{ ...publicWallet, balance_btc: 0.5 } as never]}
        loading={false}
        isOwnProfile
      />
    );
    expect(screen.getByText('Current Balance')).toBeInTheDocument();
    expect(screen.getByText('₿0.5')).toBeInTheDocument();
  });

  it('shows no goal block when the goal was not fetched either', () => {
    renderSection([publicWallet]);
    expect(screen.queryByText('Goal')).not.toBeInTheDocument();
    expect(screen.queryByText(/funded/)).not.toBeInTheDocument();
  });
});

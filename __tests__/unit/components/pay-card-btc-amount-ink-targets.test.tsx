// @vitest-environment jsdom
/**
 * The anonymous pay card and the wallet pay buttons, measured on production
 * (orangecat.ch, 2026-11-12, iPhone 13 at 390px and 1366px, dark and light):
 *
 *  - A CHF-priced product's "Pay with Lightning" card read
 *    "Amount CHF 20.00 ≈ CHF 20.00". The "≈" side went through
 *    formatAmountBtc, which renders in the viewer's display currency, so the
 *    Bitcoin figure a Lightning-address payer has to type was nowhere on the
 *    card — and a lightning: URI cannot carry it for them.
 *  - "Open in wallet" and every "Send with Wallet" were white on Bitcoin
 *    orange: 2.30:1. check:accent-ink only read `bg-accent-warm`, the same
 *    colour under its other name.
 *  - Share 97x38, Copy receiving address 308x38, "Sign in to track your
 *    order" 147x15, the wallet "Copy" 46x16 and the band's "@cato" 43x17.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';

// The viewer's display currency is CHF, at 61,250 CHF per BTC.
vi.mock('@/hooks/useDisplayCurrency', () => ({
  useDisplayCurrency: () => ({
    formatAmountBtc: (btc: number) => `CHF ${(btc * 61250).toFixed(2)}`,
    formatSats: (sats: number) => `CHF ${((sats / 1e8) * 61250).toFixed(2)}`,
    formatPrice: (amount: number, currency?: string) =>
      currency && currency !== 'BTC'
        ? `${currency} ${amount.toFixed(2)}`
        : `CHF ${(amount * 61250).toFixed(2)}`,
  }),
}));

vi.mock('@/hooks/useCurrencyConversion', () => ({
  useCurrencyConversion: () => ({ convertFromBTC: () => 0, convertToBTC: () => 0 }),
}));

import { PublicPayPanel } from '@/components/payment/PublicPayPanel';
import EntityShare from '@/components/sharing/EntityShare';
import { UnclaimedBand } from '@/components/claim/UnclaimedBand';
import ProfileWalletSection from '@/components/profile/ProfileWalletSection';

const LN_ADDRESS = 'orangecat@coinos.io';

function renderCard(props: Partial<Parameters<typeof PublicPayPanel>[0]> = {}) {
  return render(
    <PublicPayPanel
      entityTitle="Morning with Cat"
      isContribution={false}
      priceAmount={20}
      priceCurrency="CHF"
      amountBtc={0.00032655}
      method="lightning_address"
      address={LN_ADDRESS}
      signInHref="/auth?mode=login"
      {...props}
    />
  );
}

/** The whole "Lightning wallets ask for the amount" sentence, as read. */
const prompt = () => screen.getByText(/when prompted/).textContent?.replace(/\s+/g, ' ');

describe('the pay card names the Bitcoin amount', () => {
  it('a CHF price reads "CHF 20.00 ≈ ₿0.00032655", not "≈ CHF 20.00"', () => {
    renderCard();
    expect(screen.getByText('≈ ₿0.00032655', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(/≈\s*CHF/)).not.toBeInTheDocument();
  });

  it('tells a Lightning-address payer what to enter for a fixed price', () => {
    renderCard();
    expect(prompt()).toMatch(/enter CHF 20\.00 \(0\.00032655 BTC\) when prompted/);
  });

  it('a BTC price (a booking) also shows the BTC figure beside the converted one', () => {
    renderCard({ priceAmount: 0.0005, priceCurrency: 'BTC', amountBtc: 0.0005 });
    expect(screen.getByText('≈ ₿0.0005', { exact: false })).toBeInTheDocument();
    expect(prompt()).toMatch(/enter CHF 30\.63 \(0\.0005 BTC\) when prompted/);
  });

  it('on-chain needs no prompt: the bitcoin: URI carries the amount', () => {
    renderCard({ method: 'onchain', address: 'bc1qexampleaddress000000000000000000' });
    expect(screen.queryByText(/when prompted/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open in wallet/ })).toHaveAttribute(
      'href',
      expect.stringContaining('amount=0.00032655')
    );
  });
});

describe('ink on Bitcoin orange is text-on-accent', () => {
  it('"Open in wallet" on the pay card', () => {
    renderCard();
    const open = screen.getByRole('link', { name: /Open in wallet/ });
    expect(open.className).toMatch(/\bbg-bitcoinOrange\b/);
    expect(open.className).toMatch(/\btext-on-accent\b/);
    expect(open.className).not.toMatch(/\btext-white\b/);
  });

  it('"Send with Wallet" on a profile wallet', () => {
    render(
      <ProfileWalletSection
        wallets={[
          {
            id: 'w-1',
            address_or_xpub: 'bc1qexampleaddress000000000000000000',
            wallet_type: 'address',
            label: 'General',
            category: 'general',
            category_icon: '💰',
            lightning_address: null,
            is_primary: false,
            display_order: 0,
            profile_id: 'p-1',
            project_id: null,
          } as never,
        ]}
        loading={false}
        isOwnProfile={false}
      />
    );
    const send = screen.getByRole('button', { name: /Send with Wallet/ });
    expect(send.className).toMatch(/\btext-on-accent\b/);
    expect(send.className).not.toMatch(/\btext-white\b/);

    const copy = screen.getByRole('button', { name: 'Copy Bitcoin Address' });
    expect(copy.className).toMatch(/\binline-flex\b/);
    expect(copy.className).toMatch(/\bmin-h-11\b/);
    expect(copy.className).toMatch(/\bmin-w-11\b/);
  });

  describe('check:accent-ink reads bg-bitcoinOrange as the accent it is', () => {
    const SCRIPT = join(process.cwd(), 'scripts/check-accent-ink.mjs');
    let dir: string;
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'accent-ink-'));
      mkdirSync(join(dir, 'src'));
    });
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    const gate = (line: string) => {
      writeFileSync(join(dir, 'src', 'Fixture.tsx'), `${line}\n`);
      return spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: 'utf8' }).status;
    };

    it('fails white ink on a solid Bitcoin-orange fill', () => {
      expect(
        gate(`const c = 'w-full bg-bitcoinOrange hover:bg-bitcoinOrange/90 text-white';`)
      ).toBe(1);
    });

    it('leaves a tint, which takes ordinary ink, alone', () => {
      expect(gate(`const c = 'bg-bitcoinOrange/10 text-white';`)).toBe(0);
    });

    it('passes on this repository', () => {
      const r = spawnSync(process.execPath, [SCRIPT], { cwd: process.cwd(), encoding: 'utf8' });
      expect(r.stderr).toBe('');
      expect(r.status).toBe(0);
    });
  });
});

describe('pay-card and entity-page controls are 44px', () => {
  it('Copy receiving address and the track-order link', () => {
    renderCard();
    expect(screen.getByRole('button', { name: 'Copy receiving address' }).className).toMatch(
      /\bmin-h-11\b/
    );
    const track = screen.getByRole('link', { name: 'Sign in to track your order' });
    expect(track.className).toMatch(/\binline-flex\b/);
    expect(track.className).toMatch(/\bmin-h-11\b/);
  });

  it('Share', () => {
    render(<EntityShare entityType="product" entityId="p-1" title="Morning with Cat" />);
    expect(screen.getByRole('button', { name: 'Share Morning with Cat' }).className).toMatch(
      /\bmin-h-11\b/
    );
  });

  it("the unclaimed band's @handle link", () => {
    render(<UnclaimedBand ownerName="Paul" stewardUsername="cato" />);
    const handle = screen.getByRole('link', { name: '@cato' });
    expect(handle.className).toMatch(/\binline-flex\b/);
    expect(handle.className).toMatch(/\bmin-h-11\b/);
  });
});

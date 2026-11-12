// @vitest-environment jsdom
/**
 * The pay flow says what it does, and does what it says.
 *
 * Measured on orangecat.ch (2026-11-12, 390px, both themes):
 *  - the button read "Show the code" / "Show tip QR", but a phone is shown
 *    "Open in wallet" first and the code is behind a second tap;
 *  - 100000 CHF said "above the maximum" while that button stayed enabled,
 *    and pressing it only came back as the server's "Invalid request";
 *  - /pay called the link and your-name@orangecat.ch "the same door", while
 *    the address refuses anyone whose only wallet is on-chain;
 *  - the article Tip button was 34px tall.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { PayFlow } from '@/components/payment/PayFlow';
import TipButton from '@/components/tips/TipButton';
import { PAY_COPY, PAY_LANDING_COPY } from '@/config/pay';
import { TIP_COPY, TIP_MAX_BTC, TIP_MIN_BTC } from '@/config/tips';

const RATE_CHF_PER_BTC = 100_000;

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/services/tips/tip-client', () => ({
  fetchTipReceiveInfo: vi.fn(),
  fetchTipInvoice: vi.fn(),
  fetchTipStatus: vi.fn(),
}));
let canPayFromWallet = false;
vi.mock('@/hooks/useSendCapability', () => ({ useSendCapability: () => canPayFromWallet }));
vi.mock('@/hooks/useUserCurrency', () => ({ useUserCurrency: () => 'CHF' }));
vi.mock('@/hooks/useCurrencyConversion', () => ({
  useCurrencyConversion: () => ({
    isLoading: false,
    convertToBTC: (amount: number, from: string) =>
      from === 'BTC' ? amount : amount / RATE_CHF_PER_BTC,
    convertFromBTC: (btc: number, to: string) => (to === 'BTC' ? btc : btc * RATE_CHF_PER_BTC),
  }),
}));
vi.mock('@/hooks/useDisplayCurrency', () => ({
  useDisplayCurrency: () => ({
    formatAmountBtc: (btc: number) => `CHF ${(btc * RATE_CHF_PER_BTC).toFixed(2)}`,
  }),
}));
// The dialog is not under test here, only the button that opens it.
vi.mock('@/components/tips/TipDialog', () => ({ default: () => null }));

function renderFlow(amountBtc: number, words = PAY_COPY) {
  render(
    <PayFlow
      username="cato"
      recipientName="Cato"
      initialCanReceive
      initialAmountBtc={amountBtc}
      words={words}
    />
  );
}

beforeEach(() => {
  canPayFromWallet = false;
});

describe('the generate button names the action, not the code', () => {
  it('does not promise a code a phone does not show first', () => {
    for (const words of [PAY_COPY, TIP_COPY]) {
      expect(words.generate).not.toMatch(/code|QR/i);
      expect(words.generateOther).not.toMatch(/code|QR/i);
    }
  });

  it('says "another wallet" only beside "pay from my wallet"', () => {
    renderFlow(0.0001, TIP_COPY);
    expect(screen.getByRole('button', { name: TIP_COPY.generate })).toBeEnabled();
    expect(screen.queryByRole('button', { name: TIP_COPY.generateOther })).toBeNull();
  });

  it('offers a different wallet next to the one connected', () => {
    canPayFromWallet = true;
    renderFlow(0.0001, TIP_COPY);
    expect(screen.getByRole('button', { name: TIP_COPY.payFromWallet })).toBeEnabled();
    expect(screen.getByRole('button', { name: TIP_COPY.generateOther })).toBeEnabled();
  });
});

describe('an amount the field calls out of range cannot be sent', () => {
  it.each([
    ['above the maximum', TIP_MAX_BTC * 2, /above the maximum/],
    ['below the minimum', TIP_MIN_BTC / 10, /below the minimum/],
  ])('%s: the field says so and both actions are disabled', (_, btc, message) => {
    canPayFromWallet = true;
    renderFlow(btc);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: PAY_COPY.payFromWallet })).toBeDisabled();
    expect(screen.getByRole('button', { name: PAY_COPY.generateOther })).toBeDisabled();
  });

  it('the single action too, and it comes back once the amount is fixed', () => {
    renderFlow(TIP_MAX_BTC * 2, TIP_COPY);
    expect(screen.getByRole('button', { name: TIP_COPY.generate })).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '20' } });
    expect(screen.getByRole('button', { name: TIP_COPY.generate })).toBeEnabled();
  });
});

describe('the /pay landing', () => {
  it('does not call the address the same door as the link', () => {
    const [first] = PAY_LANDING_COPY.points;
    expect(first.description).not.toMatch(/same door/i);
    // The address is conditional on Lightning; the copy says which condition.
    expect(first.description).toMatch(
      /@orangecat\.ch, which works once that wallet takes Lightning/
    );
  });
});

describe('the article Tip button', () => {
  it('is a 44px tap target', () => {
    render(<TipButton username="cato" recipientName="Cato" />);
    expect(screen.getByRole('button', { name: TIP_COPY.button }).className).toContain('min-h-11');
  });
});

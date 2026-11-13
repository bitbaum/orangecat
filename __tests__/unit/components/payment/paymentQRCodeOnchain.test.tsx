// @vitest-environment jsdom
/**
 * The code screen for a person who is paid on-chain. The server hands the
 * screen a BIP21 URI. A payer sending from an exchange, or from a wallet whose
 * send field takes a bare address, needs the address and the exact BTC on
 * screen, and Copy has to give them the address. On production the screen
 * showed only "CHF 9.98" and copied `bitcoin:…?amount=…&label=…`. Lightning
 * keeps its invoice.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PaymentQRCode } from '@/components/payment/PaymentQRCode';

const viewer = { currency: 'CHF' };
vi.mock('@/hooks/useDisplayCurrency', () => ({
  useDisplayCurrency: () => ({
    formatAmountBtc: () => 'CHF 9.98',
    displayCurrency: viewer.currency,
  }),
}));

const ADDRESS = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
const BIP21 = `bitcoin:${ADDRESS}?amount=0.00016314&label=Tip+for+Penguin`;
const BOLT11 =
  'LNBC2500U1PVJLUEZPP5QQQSYQCYQ5RQWZQFQQQSYQCYQ5RQWZQFQQQSYQCYQ5RQWZQFQYPQDQ5XYSXXATSYP3K7';

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  viewer.currency = 'CHF';
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

describe('PaymentQRCode — on-chain', () => {
  function renderOnchain() {
    render(<PaymentQRCode qrData={BIP21} methodLabel="On-chain Bitcoin" amountBtc={0.00016314} />);
  }

  it('says the exact BTC that must arrive, under the fiat headline', () => {
    renderOnchain();
    expect(screen.getByText('CHF 9.98')).toBeTruthy();
    expect(screen.getByText('0.00016314 BTC must arrive in full')).toBeTruthy();
  });

  it('shows the address itself', () => {
    renderOnchain();
    expect(screen.getByText(ADDRESS)).toBeTruthy();
  });

  it('copies the bare address, labelled as an address', async () => {
    renderOnchain();
    expect(screen.queryByRole('button', { name: 'Copy invoice' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Copy address' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(ADDRESS));
  });

  it('still opens the wallet with the whole URI, amount included', () => {
    renderOnchain();
    expect(screen.getByRole('link', { name: 'Open in wallet' }).getAttribute('href')).toBe(BIP21);
  });
});

describe('PaymentQRCode — Lightning', () => {
  it('shows the BTC the wallet will show under the franc headline', () => {
    render(<PaymentQRCode qrData={BOLT11} methodLabel="Lightning" amountBtc={0.0025} />);
    expect(screen.getByText('CHF 9.98')).toBeTruthy();
    expect(screen.getByText(/0\.0025\d* BTC/)).toBeTruthy();
    expect(screen.queryByText(/must arrive/)).toBeNull();
  });

  it('does not repeat the BTC for a viewer who reads BTC', () => {
    viewer.currency = 'BTC';
    render(<PaymentQRCode qrData={BOLT11} methodLabel="Lightning" amountBtc={0.0025} />);
    expect(screen.queryByText(/0\.0025\d* BTC/)).toBeNull();
  });

  it('copies the invoice and shows no address', async () => {
    render(
      <PaymentQRCode
        qrData={BOLT11}
        methodLabel="Lightning"
        amountBtc={0.0025}
        expiresInSeconds={600}
      />
    );
    expect(screen.queryByText(/must arrive/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Copy invoice' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(BOLT11.toLowerCase()));
    expect(screen.getByRole('link', { name: 'Open in wallet' }).getAttribute('href')).toBe(
      `lightning:${BOLT11.toLowerCase()}`
    );
  });
});

// @vitest-environment jsdom
/**
 * "Pay from my wallet": a signed-in payer with a wallet connected pays the
 * invoice the page mints, without leaving. The four outcomes that matter:
 * it pays and the receipt shows; a wallet that says no leaves the code on
 * screen; a TIMEOUT never offers a second payment; and a visitor who cannot
 * pay this way sees exactly what they saw before.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PayFlow } from '@/components/payment/PayFlow';
import { PAY_COPY } from '@/config/pay';
import { fetchTipInvoice, fetchTipStatus } from '@/services/tips/tip-client';
import { SendError, payIntentFromWallet } from '@/services/send/send-client';
import type { Mock } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/services/tips/tip-client', () => ({
  fetchTipReceiveInfo: vi.fn(),
  fetchTipInvoice: vi.fn(),
  fetchTipStatus: vi.fn(),
}));
vi.mock('@/services/send/send-client', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/send/send-client')>()),
  payIntentFromWallet: vi.fn(),
}));
let canPayFromWallet = true;
vi.mock('@/hooks/useSendCapability', () => ({ useSendCapability: () => canPayFromWallet }));
vi.mock('@/hooks/useUserCurrency', () => ({ useUserCurrency: () => 'CHF' }));
vi.mock('@/components/payment/PaymentQRCode', () => ({
  PaymentQRCode: () => <div data-testid="the-code">code</div>,
}));

const invoice = {
  intentId: 'i1',
  statusToken: 'tok_abc',
  qrData: 'lnbc1',
  methodLabel: 'Lightning',
  recipientName: 'Mao',
  amountBtc: 0.0002,
  expiresInSeconds: 3000,
};

function renderFlow() {
  render(
    <PayFlow
      username="mao"
      recipientName="Mao"
      initialCanReceive
      initialAmountBtc={0.0002}
      requestId="3f6c1a52-8b0e-4f4a-9a0c-2d7e5b9c1a10"
      words={PAY_COPY}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  canPayFromWallet = true;
  (fetchTipInvoice as Mock).mockResolvedValue(invoice);
  (fetchTipStatus as Mock).mockResolvedValue({ status: 'pending', paidAt: null });
});

describe('PayFlow — pay from my wallet', () => {
  it('pays the minted invoice and ends on the receipt', async () => {
    (payIntentFromWallet as Mock).mockResolvedValue({ paymentHash: 'h' });
    (fetchTipStatus as Mock).mockResolvedValue({ status: 'paid', paidAt: 'now' });
    renderFlow();

    expect(screen.getByText("They'll see it was you.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pay from my wallet' }));

    await waitFor(() => expect(screen.getByText('Paid')).toBeTruthy());
    // The invoice carries the request, and the payment is made against THAT invoice.
    expect(fetchTipInvoice).toHaveBeenCalledWith(
      'mao',
      0.0002,
      '3f6c1a52-8b0e-4f4a-9a0c-2d7e5b9c1a10'
    );
    expect(payIntentFromWallet).toHaveBeenCalledWith('i1', 'tok_abc');
  });

  it('keeps the code on screen when the wallet says no', async () => {
    (payIntentFromWallet as Mock).mockRejectedValue(
      new SendError('Check your wallet has enough balance.', 'payment_failed')
    );
    renderFlow();
    fireEvent.click(screen.getByRole('button', { name: 'Pay from my wallet' }));

    expect(await screen.findByTestId('the-code')).toBeTruthy();
    expect(screen.getByText(/Check your wallet has enough balance/)).toBeTruthy();
  });

  it('never offers a second payment after a timeout', async () => {
    (payIntentFromWallet as Mock).mockRejectedValue(
      new SendError("We couldn't confirm this payment in time.", 'payment_unconfirmed')
    );
    renderFlow();
    fireEvent.click(screen.getByRole('button', { name: 'Pay from my wallet' }));

    expect(await screen.findByText('Not confirmed yet')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pay from my wallet' })).toBeNull();
    expect(screen.queryByTestId('the-code')).toBeNull();
    // One invoice was ever minted: nothing here could have started another payment.
    expect(fetchTipInvoice).toHaveBeenCalledTimes(1);
  });

  it('shows a visitor who cannot pay this way exactly what they saw before', () => {
    canPayFromWallet = false;
    renderFlow();

    expect(screen.queryByRole('button', { name: 'Pay from my wallet' })).toBeNull();
    expect(screen.getByRole('button', { name: PAY_COPY.generate })).toBeTruthy();
  });
});
